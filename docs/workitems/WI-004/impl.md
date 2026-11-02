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
- Audit lines for guests never contain the full guest identifier. The guest's audit actor is a keyed HMAC of the identifier, prefixed `guest:` (for example `guest:<hash>`), so lines from the same guest can still be matched. Account identifiers are logged unchanged. Stored audit records keep the hash, not the identifier.
- The HMAC key is the environment variable `AUDIT_HASH_KEY`. It has no default and must not reuse `JWT_SECRET`. The API refuses to start when `AUDIT_HASH_KEY` is missing, empty, shorter than 32 characters, or equal to `JWT_SECRET`. Tests supply a fake key the same way they already supply `JWT_SECRET`: a constant of at least 32 characters, different from the test `JWT_SECRET`, passed through `withEnv` in every test file that builds the app or writes audit lines (`tests/modules/billing/contract/queryRoute.test.ts` and `tests/modules/billing/fit/routes.test.ts`). A real key goes only in `apps/api/.env`, never in test files or committed code. It never falls back to logging the guest identifier in the clear, and it never skips guest audit lines silently, because a gap in the audit trail would go unnoticed. The name is listed in `.env.example` with no value.
- Where the check runs: in `start()` (`apps/api/src/http/server.ts`), before the app is created and migrations run. `main.ts` calls `start()`, so `npm run dev` and `npm start` both stop there. The hashing helper reads `AUDIT_HASH_KEY` when a line is written, not at import time, because the billing audit trail is built when the glue routes are imported.
- Startup error text names the variable and the rule only (for example "AUDIT_HASH_KEY must be set in apps/api/.env: at least 32 characters, and different from JWT_SECRET"). It never prints the key or the length of the value.
- Test: when `AUDIT_HASH_KEY` is missing, too short or equal to `JWT_SECRET`, the thrown error message must not contain the key value or its length. The test sets each case with `withEnv`, calls the start check, and asserts that the error names `AUDIT_HASH_KEY` and that its message contains neither the key value nor the length.
- Tests that call `start()` or write guest audit lines need the fake key: `tests/modules/express/contract/server.test.ts`, `tests/modules/billing/fit/routes.test.ts` (both through `start()`) and `tests/modules/billing/contract/queryRoute.test.ts` (guest charge lines). The other test files need no change: `app.test.ts` calls `createApp()` only, `glue.test.ts` imports the glue routes without writing audit lines, and `ledger.test.ts` writes no audit lines.

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
- Error handler (`apps/api/src/http/app.ts`, around line 41): on a 500 it prints the whole error object. A database error could carry a guest identifier in its message or bound values, which would then appear in logs. Follow-up, not in this item; review it when the database is wired in.

## Assumptions
- The WhatsApp connect and verify flow already exists or is provided elsewhere; this work only hooks into its verified event.
- Payment provider integration is out of scope. The API returns the price; the existing payment step takes it.
- No expiry, no per-user cap beyond the once-per-user bonus rule.
