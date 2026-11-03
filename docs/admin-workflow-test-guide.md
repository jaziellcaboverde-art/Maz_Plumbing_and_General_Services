# Test the connected workspaces

Use `fixed-adminside` to test customer, admin and provider together. It includes `fixed-customerside` and the earlier provider workspace. The customer branch keeps customer screens and shared database/API changes separately reviewable. Neither branch bypasses protected `main` review requirements.

The DOCX's business requirements drive the implemented flow. MAZ must supply real service-specific inspection policies, payment instructions, fees and project terms. No bank or wallet account, cancellation penalty or universal deposit percentage has been invented.

## Manual acceptance scenario

1. Admin: open `/admin/config`; configure selected inspection services and verified MAZ payment instructions. Edit the service catalog through `/admin/services`.
2. Customer: submit the four-step service request. Choose a requested Philippine-time appointment and optionally an alternate time or preferred worker. Submission is Pending, not a confirmed date or provider selection.
3. Admin: open the booking from `/admin/bookings`. Review coverage and scope, record the decision and applicable inspection/contract requirements. Offer qualified inspection or execution roles with valid worker availability and 24–48-hour response deadlines.
4. Provider: accept the role from `/provider/offers`, propose any changed inspection time or execution work period. Customer: accept the proposed period. Admin: confirm the accepted lead and appointment. The server checks full-team consent, required payment and contract approval before execution confirmation.
5. If chargeable inspection applies, customer submits payment through a configured channel. Admin verifies actual receipt for manual payments. Provider submits inspection findings; admin reviews them before quoting. Inspection principal counts once toward the approved project.
6. Admin: issue a line-item quotation with scope, inclusions/exclusions, duration, validity and the explicitly chosen payment requirement. Add dated or milestone installments where applicable; deposit plus installments cannot exceed the gross quote. Customer: approve the exact quotation version. Declining a quotation leaves cancellation to a separate MAZ decision.
7. Admin: issue the contract when required. Customer: approve the exact document version. Additional work requires an admin-issued change order with cost/time impact and separate customer approval. Accepted documents remain immutable and are visible in the provider's approved scope.
8. Customer: pay the remaining execution requirement. Manual proof stays pending until verified. For PayMongo, use configured test credentials and a reachable webhook endpoint; a browser redirect does not mark a payment paid. Processing fees are separately disclosed. Admin can retrieve an existing checkout from `/admin/payments` for reconciliation without creating another charge. A canonical expired session can be retired; unresolved sessions prevent overlapping collection channels.
9. Admin: confirm the complete execution team and customer-agreed periods, then authorize execution on the scheduled work day. Provider: submit progress, milestone and completion evidence. Admin: approve evidence or request corrections. Customer sees approved evidence only.
10. Admin: verify the lead's completion, completed required roles and approved milestones, then sign off the project. Customer: acknowledge turnover and settle the final balance. Admin: reconcile verified funds and close. Service completion and financial settlement remain distinct.
11. Customer: submit a company review, optionally permit publication and choose attribution; worker feedback stays private. Company review edits are limited to 14 days. Grant project-photo permission separately. Admin: review selected approved images and publish a public-safe project entry. Customer: withdraw permission; the entry disappears from the public gallery.
12. Customer: request cancellation, a change, dispute or refund. Admin: document approval/denial. An approved cancellation releases that project's active worker reservations and pending appointment proposals; a request alone does not. Refund review stays separate. Record a manual refund only after actual settlement. For PayMongo, issue the approved refund in its dashboard and verify the matching succeeded refund reference in the booking. Pending refunds and duplicate callbacks do not change the ledger again.

Offline intake for an existing customer is available at `/admin/create-booking`, with a saved customer-owned address/map pin and source channel. Quotes/contracts, payments/requests, assignments, provider evidence, publication and reports all link back to the managed booking detail. Reports aggregate complete booking cohorts in SQL, not the first API page; they show current project finances and are not a cash-flow statement or tax receipt.

## Automated validation

- `npm.cmd run typecheck` passed after the new routes were added.
- Production build passed after self-hosting the existing Inter font. Provider offer expiry waits for authenticated request-time rendering.
- Focused suite: 6 files, 48 tests passed (workflow authorization, canonical gateway matching/recovery, booking form and date rules, provider workspace and requirements).
- Targeted ESLint passed for the new workflow components, libraries, API routes and tests.
- Authenticated Edge smoke checks passed for 19 pages: 11 admin routes (including managed booking detail), 4 customer routes and 4 provider routes. Every page returned HTTP 200 with its heading and no booking-load error. Temporary test accounts were removed afterward. This checks page loading; the SQL scenarios exercise the full state-changing flow.
- Synthetic SQL scenarios ran against the deployed schema inside rolled-back transactions, including actual authenticated-role RLS, inspection credit, contract/quote versions, evidence gates, turnover, refunds, opt-in publication, withdrawal and gateway replay safety. No live charges/refunds were made.
- Full suite: 494 passed, 7 failed out of 501. Remaining failures are the pre-existing raw-token scan, font-size/radius token-count assumptions, global focus/animation checks, and duplicate timestamps from unrelated untracked legacy SQL files. The new workflow's focused tests pass. An obsolete test requiring the business-configuration page to be absent was removed because that contradicts this workflow's requirements.

Run gateway testing with PayMongo test credentials before production rollout. Complete real-account acceptance testing with MAZ's actual service coverage, terms, payment channels and project policies.
