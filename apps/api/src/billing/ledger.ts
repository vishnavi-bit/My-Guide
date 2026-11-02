// Query allowance and credit balances (WI-004). Free queries and bonus credits are separate counters per subject (a signed-in
// user or a guest), and every table goes through the tenant-scoped data access.
import type { Db } from '../db/client';
import { asExecutor } from '../db/client';
import { createTenantDb, TenantScope } from '../tenancy/tenantDb';

export const FREE_QUERY_ALLOWANCE = 2;
export const WHATSAPP_BONUS_CREDITS = 2;
export const SETTING_BONUS_ACTIVE = 'whatsapp_bonus_active';
export const SETTING_PRICE_CENTS = 'query_price_cents';

export const billingTables = {
  billing_balances: ['subject_id', 'free_queries', 'bonus_credits'],
  billing_bonus_grants: ['user_id', 'granted_at'],
  billing_whatsapp: ['user_id', 'phone', 'code_hash', 'code_expires_at', 'attempts', 'verified_at'],
  billing_settings: ['key', 'value']
};

/** A failure the HTTP layer reports as `status` with `message` as the error code. */
export class BillingError extends Error {
  constructor(public status: number, code: string) {
    super(code);
    this.name = 'BillingError';
  }
}

export type Subject = { kind: 'user' | 'guest'; id: string };
export const subjectKey = (s: Subject) => `${s.kind}:${s.id}`;

/** free / bonus: a useful answer used one; not-charged: no useful plan; payment-required: the allowance is used up. */
export type Charge = 'free' | 'bonus' | 'payment-required' | 'not-charged';
export interface Balance { freeQueries: number; bonusCredits: number; priceCents: number | null }

const MAX_ATTEMPTS = 5;

export function billingScope(db: Db, tenantId: string): TenantScope {
  return createTenantDb(asExecutor(db), { tables: billingTables })(tenantId);
}

const isUniqueViolation = (e: unknown) => /UNIQUE constraint|SQLITE_CONSTRAINT/i.test(String((e as Error)?.message ?? e));

interface Counters { free: number; bonus: number }

async function ensureRow(t: TenantScope, key: string, freeQueries: number): Promise<void> {
  if ((await t.select('billing_balances', { subject_id: key }, { limit: 1 })).length) return;
  try {
    await t.insert('billing_balances', { subject_id: key, free_queries: freeQueries, bonus_credits: 0 });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;                                  // another request created it first
  }
}

async function readCounters(t: TenantScope, key: string): Promise<Counters> {
  await ensureRow(t, key, FREE_QUERY_ALLOWANCE);
  const [row] = await t.select('billing_balances', { subject_id: key }, { limit: 1 });
  return { free: Number(row.free_queries), bonus: Number(row.bonus_credits) };
}

// Optimistic update: the write only lands while both counters still hold the values that were read, so two requests can
// never spend the same allowance twice. `decide` returns `next` to write, or nothing to leave the counters alone.
async function apply<T>(t: TenantScope, key: string, decide: (r: Counters) => { next?: Counters; out: T }): Promise<T> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const read = await readCounters(t, key);
    const { next, out } = decide(read);
    if (!next) return out;
    const changed = await t.update(
      'billing_balances',
      { free_queries: next.free, bonus_credits: next.bonus },
      { subject_id: key, free_queries: read.free, bonus_credits: read.bonus }
    );
    if (changed === 1) return out;
  }
  throw new BillingError(409, 'busy');
}

async function setting(t: TenantScope, key: string): Promise<string | null> {
  const [row] = await t.select('billing_settings', { key }, { limit: 1 });
  return row ? String(row.value) : null;
}

export async function setSetting(db: Db, tenantId: string, key: string, value: string): Promise<void> {
  const t = billingScope(db, tenantId);
  await t.remove('billing_settings', { key });
  await t.insert('billing_settings', { key, value });
}

export async function isWhatsAppBonusActive(db: Db, tenantId: string): Promise<boolean> {
  return (await setting(billingScope(db, tenantId), SETTING_BONUS_ACTIVE)) === 'true';
}

export async function getPriceCents(db: Db, tenantId: string): Promise<number | null> {
  const raw = await setting(billingScope(db, tenantId), SETTING_PRICE_CENTS);
  const cents = raw === null ? NaN : Number(raw);
  return Number.isInteger(cents) && cents >= 0 ? cents : null;
}

export async function getBalance(db: Db, tenantId: string, subject: Subject): Promise<Balance> {
  const t = billingScope(db, tenantId);
  const c = await readCounters(t, subjectKey(subject));
  return { freeQueries: c.free, bonusCredits: c.bonus, priceCents: await getPriceCents(db, tenantId) };
}

/**
 * Called by the query engine once an answer is produced. The caller decides `useful`; a query without a useful action plan is
 * never charged. Order of use: free queries, then bonus credits, then payment (the price is quoted, never taken here).
 */
export async function recordAnsweredQuery(db: Db, tenantId: string, subject: Subject, useful: boolean): Promise<{ charge: Charge; balance: Balance }> {
  const t = billingScope(db, tenantId);
  const charge = await apply<Charge>(t, subjectKey(subject), (r) => {
    if (!useful) return { out: 'not-charged' };
    if (r.free > 0) return { next: { free: r.free - 1, bonus: r.bonus }, out: 'free' };
    if (r.bonus > 0) return { next: { free: r.free, bonus: r.bonus - 1 }, out: 'bonus' };
    return { out: 'payment-required' };
  });
  return { charge, balance: await getBalance(db, tenantId, subject) };
}

/**
 * Moves a guest's remaining free queries to the account that the guest just signed in to. The guest row is removed first, under
 * the count that was read, so a concurrent use of the guest allowance makes this a no-op instead of a double transfer. An account
 * with no balance yet takes the guest's remainder as its starting allowance; one that already has a balance gains it on top.
 */
export async function transferGuestBalance(db: Db, tenantId: string, guestId: string, userId: string): Promise<number> {
  const t = billingScope(db, tenantId);
  const guestKey = subjectKey({ kind: 'guest', id: guestId });
  const userKey = subjectKey({ kind: 'user', id: userId });
  const [row] = await t.select('billing_balances', { subject_id: guestKey }, { limit: 1 });
  if (!row) return 0;
  const guestFree = Number(row.free_queries);
  if (guestFree === 0) return 0;
  if ((await t.remove('billing_balances', { subject_id: guestKey, free_queries: guestFree })) !== 1) return 0;
  if ((await t.select('billing_balances', { subject_id: userKey }, { limit: 1 })).length === 0) {
    try {
      await t.insert('billing_balances', { subject_id: userKey, free_queries: guestFree, bonus_credits: 0 });
      return guestFree;
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  return apply(t, userKey, (r) => ({ next: { free: r.free + guestFree, bonus: r.bonus }, out: guestFree }));
}

/**
 * Adds the WhatsApp bonus once per user, and only while the offer is active. Returns whether a grant was made.
 * The grant row is written first, so a repeated verification cannot add the credits twice.
 */
export async function grantWhatsAppBonus(db: Db, tenantId: string, userId: string): Promise<boolean> {
  if (!(await isWhatsAppBonusActive(db, tenantId))) return false;
  const t = billingScope(db, tenantId);
  try {
    await t.insert('billing_bonus_grants', { user_id: userId, granted_at: new Date().toISOString() });
  } catch (e) {
    if (isUniqueViolation(e)) return false;
    throw e;
  }
  await apply(t, subjectKey({ kind: 'user', id: userId }), (r) => ({ next: { free: r.free, bonus: r.bonus + WHATSAPP_BONUS_CREDITS }, out: undefined }));
  return true;
}
