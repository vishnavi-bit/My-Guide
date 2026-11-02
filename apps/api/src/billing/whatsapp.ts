// WhatsApp connection with a one-time code (WI-004). The code is sent through a sender the deployment provides; without one,
// connecting is refused rather than pretending a code was sent. Codes are stored as hashes, expire, and lock after too many tries.
import crypto from 'crypto';
import type { Db } from '../db/client';
import { BillingError, billingScope, grantWhatsAppBonus } from './ledger';

export interface WhatsAppSender { sendCode(phone: string, code: string): Promise<void> }

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
const E164 = /^\+[1-9]\d{7,14}$/;
const CODE = /^\d{6}$/;

const hashCode = (userId: string, code: string) => crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Starts (or restarts) the connection: a new code replaces any pending one. */
export async function startWhatsAppConnect(
  db: Db,
  tenantId: string,
  userId: string,
  phone: string,
  sender: WhatsAppSender | null,
  now: number = Date.now()
): Promise<{ expiresAt: number }> {
  if (!E164.test(phone)) throw new BillingError(422, 'invalid-phone');
  if (!sender) throw new BillingError(503, 'whatsapp-not-configured');
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const t = billingScope(db, tenantId);
  await t.remove('billing_whatsapp', { user_id: userId });
  await t.insert('billing_whatsapp', {
    user_id: userId,
    phone,
    code_hash: hashCode(userId, code),
    code_expires_at: now + CODE_TTL_MS,
    attempts: 0,
    verified_at: null
  });
  await sender.sendCode(phone, code);
  return { expiresAt: now + CODE_TTL_MS };
}

/** Checks the code. On success the number is verified and the WhatsApp bonus is granted when the offer is active. */
export async function verifyWhatsAppCode(
  db: Db,
  tenantId: string,
  userId: string,
  code: string,
  now: number = Date.now()
): Promise<{ verified: true; bonusGranted: boolean }> {
  const t = billingScope(db, tenantId);
  const [row] = await t.select('billing_whatsapp', { user_id: userId }, { limit: 1 });
  if (!row || row.code_hash === '') throw new BillingError(409, 'no-pending-verification');
  if (Number(row.code_expires_at) < now) throw new BillingError(410, 'code-expired');
  const attempts = Number(row.attempts);
  if (attempts >= MAX_CODE_ATTEMPTS) throw new BillingError(429, 'too-many-attempts');
  const matches = CODE.test(code) && sameHash(String(row.code_hash), hashCode(userId, code));
  if (!matches) {
    await t.update('billing_whatsapp', { attempts: attempts + 1 }, { user_id: userId, attempts });
    throw new BillingError(422, 'wrong-code');
  }
  // The code is used up on success: a second submit of the same code is refused.
  const consumed = await t.update('billing_whatsapp', { code_hash: '', verified_at: now }, { user_id: userId, attempts });
  if (consumed !== 1) throw new BillingError(409, 'no-pending-verification');
  const bonusGranted = await grantWhatsAppBonus(db, tenantId, userId);
  return { verified: true, bonusGranted };
}
