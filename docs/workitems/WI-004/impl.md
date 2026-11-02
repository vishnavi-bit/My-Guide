Applications: api (primary), web

# WI-004 Implementation: Free query allowance and WhatsApp bonus credits

Requirement: REQ-007 (approved). Decision: DEC-036. Feature: FEAT-475.

## Approach
- Keep the balance model on the API. Two separate balances per subject: free queries and bonus credits. Nothing is shared.
- Eligibility covers guests and signed-in users alike. A guest is identified by a unique browser identifier. On sign-up, the remaining free-query balance moves to the account without a reset. Bonus credits are not part of the guest transfer rule and are only granted to a verified WhatsApp connection.
- Charge logic: each query first spends a free query if one remains. Otherwise the API returns the exact price and what the user receives before any payment is requested. A query that does not produce a useful action plan is never charged and never uses a free query.
- WhatsApp bonus: when the offer is switched on, verifying a connected WhatsApp number adds two bonus credits, once per user. When the offer is off, verification adds nothing.
- The offer is an admin toggle in the pricing and credit configuration. No date-based scheduling.
- Credits do not expire.

## Areas and files likely affected
API (primary)
- apps/api/src/db/schema.ts: balance tables (free queries, bonus credits, guest identifier mapping), the offer toggle setting. The existing `settings` table can hold the toggle.
- apps/api/src/db/migrate.ts and the SQL migrations: matching migration for the new tables.
- New module for balances and charging (e.g. apps/api/src/billing/): consume free query, grant bonus, guest-to-account transfer, price quote.
- apps/api/src/glue/routes.ts and apps/api/src/http/app.ts: query endpoint that returns the quote or the answer; balance endpoint; WhatsApp verification hook that grants bonus.
- apps/api/src/auth/authMiddleware.ts: guest identifier handling alongside signed-in users.
- apps/api/src/tenancy/tenantDb.ts: balances must be scoped to the tenant.
- apps/api/src/audit/auditTrail.ts: record balance changes.

Web (other)
- apps/web/src/app/router.tsx and a new component: show remaining free queries and credits.
- Price and what-you-receive confirmation before payment is requested.
- apps/web/src/state/createStore.ts or useAsync.ts: balance state.

## Risks
- Guest abuse through cleared or new browser identifiers. Accepted by the requirement; tracking is per browser identifier only.
- Race conditions when two queries consume the last free query at the same time. Decrement must be atomic.
- Double bonus grant on repeated WhatsApp verification. Needs a unique per-user marker.
- Guest-to-account transfer on sign-up must not double count if sign-up is retried.
- Toggle changes mid-flow: a user who passed verification while the offer was on keeps the grant only if it was applied at that time.

## Assumptions
- The WhatsApp connect and verify flow already exists or is provided elsewhere; this work only hooks into its verified event.
- Payment provider integration is out of scope. The API returns the price; the existing payment step takes it.
- No expiry, no per-user cap beyond the once-per-user bonus rule.
