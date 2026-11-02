// HTTP routes of the billing feature (WI-004). Balances are shown to the caller; the query engine calls recordAnsweredQuery
// itself, so no route lets a client claim that an answer was useful or not.
import type { Request, Router } from 'express';
import type { Db } from '../db/client';
import type { AuthClaims } from '../auth/jwt';
import { requireAuth, requireRole } from '../auth/authMiddleware';
import { wrapAsync } from '../http/app';
import { BillingError, Subject, getBalance, setSetting, SETTING_BONUS_ACTIVE, SETTING_PRICE_CENTS } from './ledger';
import { WhatsAppSender, startWhatsAppConnect, verifyWhatsAppCode } from './whatsapp';

export type BillingRequest = Request & { tenantId?: string; auth?: AuthClaims };

const GUEST_ID = /^[A-Za-z0-9_-]{8,128}$/;

// A signed-in user is identified by the token; anyone else sends a browser id in X-Guest-Id (the guest allowance key).
export function subjectOf(req: BillingRequest): Subject {
  if (req.auth) return { kind: 'user', id: req.auth.userId };
  const guest = req.headers['x-guest-id'];
  if (typeof guest === 'string' && GUEST_ID.test(guest)) return { kind: 'guest', id: guest };
  throw new BillingError(401, 'guest-id-required');
}

export const tenantOf = (req: BillingRequest): string => {
  if (!req.tenantId) throw new BillingError(401, 'tenant-required');
  return req.tenantId;
};
export const dbOf = (req: BillingRequest): Db => req.app.get('db') as Db;

export function createBillingRoutes(options: { sender: WhatsAppSender | null }) {
  return {
    id: 'billing',
    mount(router: Router) {
      // A balance must never come from the response cache: it changes with every answered query.
      router.get('/api/billing/balance', wrapAsync(async (req, res) => {
        const r = req as BillingRequest;
        res.setHeader('Cache-Control', 'no-store');
        res.json(await getBalance(dbOf(r), tenantOf(r), subjectOf(r)));
      }));

      router.put('/api/billing/whatsapp-bonus', requireRole('admin') as any, wrapAsync(async (req, res) => {
        const r = req as BillingRequest;
        const active = (req.body ?? {}).active;
        if (typeof active !== 'boolean') throw new BillingError(422, 'active-must-be-boolean');
        await setSetting(dbOf(r), tenantOf(r), SETTING_BONUS_ACTIVE, active ? 'true' : 'false');
        res.json({ whatsappBonusActive: active });
      }));

      router.put('/api/billing/price', requireRole('admin') as any, wrapAsync(async (req, res) => {
        const r = req as BillingRequest;
        const cents = (req.body ?? {}).cents;
        if (!Number.isInteger(cents) || cents < 0) throw new BillingError(422, 'cents-must-be-whole-number');
        await setSetting(dbOf(r), tenantOf(r), SETTING_PRICE_CENTS, String(cents));
        res.json({ priceCents: cents });
      }));

      router.post('/api/whatsapp/connect', requireAuth as any, wrapAsync(async (req, res) => {
        const r = req as BillingRequest;
        const phone = String((req.body ?? {}).phone ?? '');
        const out = await startWhatsAppConnect(dbOf(r), tenantOf(r), r.auth!.userId, phone, options.sender);
        res.status(202).json(out);
      }));

      router.post('/api/whatsapp/verify', requireAuth as any, wrapAsync(async (req, res) => {
        const r = req as BillingRequest;
        const code = String((req.body ?? {}).code ?? '');
        res.json(await verifyWhatsAppCode(dbOf(r), tenantOf(r), r.auth!.userId, code));
      }));
    }
  };
}
