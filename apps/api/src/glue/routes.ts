// Scaffold-owned glue file (STORY-105). Modules register at the markers below; do not edit the marked lines by hand.
// knm:imports
import { createBillingRoutes } from '../billing/routes';

export const routes = [
  // knm:entries
  createBillingRoutes({ sender: null }),   // WI-004: no WhatsApp sender is configured yet, so connecting answers 503
  // knm:entries-end
];
