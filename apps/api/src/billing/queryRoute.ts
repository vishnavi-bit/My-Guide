// HTTP route of the query endpoint (WI-004). `useful` comes only from the engine, never from the request body. When the
// allowance is used up, the answer is withheld and the exact price is returned instead; nothing is charged here.
import type { Router } from 'express';
import { wrapAsync } from '../http/app';
import { BillingError, getPriceCents, recordAnsweredQuery } from './ledger';
import { QueryEngine, stubQueryEngine } from './queryEngine';
import { BillingRequest, billingAudit, dbOf, subjectOf, tenantOf } from './routes';

const MAX_QUESTION_CHARS = 2000;

export function createQueryRoute(options: { engine: QueryEngine } = { engine: stubQueryEngine }) {
  return {
    id: 'billing-query',
    mount(router: Router) {
      router.post('/api/billing/query', wrapAsync(async (req, res) => {
        const r = req as BillingRequest;
        const question = (req.body ?? {}).question;
        if (typeof question !== 'string' || question.trim() === '' || question.length > MAX_QUESTION_CHARS) {
          throw new BillingError(422, 'question-required');
        }
        const db = dbOf(r);
        const tenantId = tenantOf(r);
        const subject = subjectOf(r);
        res.setHeader('Cache-Control', 'no-store');

        const answer = await options.engine.answer({ tenantId, question });
        const { charge, balance } = await recordAnsweredQuery(db, tenantId, subject, answer.useful);
        await billingAudit.record({ actor: subject.id, action: 'billing.charge', tenantId, meta: { subject: subject.kind, charge } });
        if (charge !== 'payment-required') {
          res.json({ answer: answer.text, charge, balance });
          return;
        }
        const priceCents = await getPriceCents(db, tenantId);
        if (priceCents === null) throw new BillingError(503, 'price-not-configured');
        res.status(402).json({ error: 'payment-required', quote: { priceCents, receives: { answeredQueries: 1 } }, balance });
      }));
    }
  };
}
