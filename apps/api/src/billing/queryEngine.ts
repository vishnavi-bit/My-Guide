// The answer side of the query endpoint (WI-004). The engine decides whether an answer is useful; the HTTP request never says so.
import { BillingError } from './ledger';

export interface QueryAnswer { text: string; useful: boolean }
export interface QueryEngine { answer(input: { tenantId: string; question: string }): Promise<QueryAnswer> }

// STUB (WI-004): this repository has no query engine yet. Replace this object with the real engine when it exists (and pass that
// engine to createQueryRoute in src/billing/queryRoute.ts). Until then the endpoint answers 503 and charges nothing.
export const stubQueryEngine: QueryEngine = {
  async answer() {
    throw new BillingError(503, 'query-engine-not-configured');
  }
};
