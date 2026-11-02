// Scaffold-owned glue file (STORY-105). Modules register at the markers below; do not edit the marked lines by hand.
// knm:imports
import { createBillingRoutes } from '../billing/routes';
import { createQueryRoute } from '../billing/queryRoute';

export const routes = [
  // knm:entries
  createBillingRoutes({ sender: null }),   // WI-004: no WhatsApp sender is configured yet, so connecting answers 503
  createQueryRoute(),                      // WI-004: query endpoint with the stub engine (src/billing/queryEngine.ts), answers 503 until replaced
  // knm:entries-end
];
