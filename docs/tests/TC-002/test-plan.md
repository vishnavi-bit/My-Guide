# TC-002 Test plan: Free query allowance and WhatsApp bonus credits

Requirement: REQ-007 (approved). Work item: WI-004.
Automated coverage: apps/api/tests/modules/billing/contract/ledger.test.ts and queryRoute.test.ts.

## Scenarios

1. **Free allowance for a new subject (guest or signed-in)**
   - Steps: read the balance for a new guest browser id and for a new user.
   - Expected: 2 free queries, 0 bonus credits.

2. **Each useful answer uses one free query**
   - Steps: a guest asks two useful questions.
   - Expected: both charged as `free`; the free-query balance goes 2 → 1 → 0. No payment requested.

3. **Unhelpful answers are never charged**
   - Steps: a guest gets five answers without a useful action plan.
   - Expected: each is `not-charged`; the free-query balance stays at 2.

4. **Price shown once the free allowance is used**
   - Steps: after two free queries, ask a third useful question. Price is configured in settings (e.g. 250 cents).
   - Expected: charge is `payment-required`, the answer is withheld, the exact price and what the user receives are returned, and nothing is debited.

5. **Free queries and bonus credits are separate balances**
   - Steps: grant the WhatsApp bonus to a user, then ask useful questions until both are used.
   - Expected: free queries are used first (`free`), then bonus credits (`bonus`); bonus credits drop by one per use and the free-query counter is unaffected by bonus use.

6. **Price comes from settings**
   - Expected: no price while unset; 250 when set to `250`; no price for an invalid value.

7. **Guest balance moves to the account on sign-up without reset**
   - Steps: a guest uses one free query, then signs up.
   - Expected: the remaining 1 moves to the user; a second transfer moves nothing.

8. **Transfer merges with an existing account balance and never double counts**
   - Steps: a signed-in user with a balance of 1 receives a guest balance of 1.
   - Expected: the account ends with 2. Transfer of an unknown guest moves 0.

9. **WhatsApp bonus only while the offer is active, once per user**
   - Expected: grant returns false while the offer is off; with the offer on, the first grant returns true, the second returns false, and the user has 2 bonus credits.

10. **WhatsApp verification grants the bonus only when the offer is active**
    - Steps: connect and verify a WhatsApp number with the offer on, then with the offer off.
    - Expected: `{ verified: true, bonusGranted: true }` with the offer on; `{ verified: true, bonusGranted: false }` with it off, and no bonus credits added.

11. **Concurrent use of the last free query**
    - Steps: one free query left; two useful answers run at the same time.
    - Expected: one is `free`, the other `payment-required`; the balance ends at 0.

12. **Balances are tenant-scoped**
    - Expected: usage under one tenant does not change another tenant's balance.

13. **Request body cannot claim usefulness**
    - Steps: POST to the query endpoint with an extra `useful: true` field while the engine reports not useful.
    - Expected: `not-charged`, and the balance is unchanged.

14. **Query endpoint after allowance**
    - Expected: HTTP response includes the exact price and what the user receives before any payment step.

## Out of scope
- Payment provider behaviour (the API returns the price only).
- Bonus credit expiry (none: credits do not expire).
