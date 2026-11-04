# Workflow and database audit — 2026-11-05

The admin, customer and provider workflows were checked against the current direct-assignment, MAZ-approved quotation/schedule and contract-dependent payment rules. No commit or push was performed.

## Repairs applied

- Resolved the duplicate migration version without rewriting the deployed payment-reconciliation migration. The previously undeployed manual-customer migration is now version 20261105060000 and was applied successfully.
- Added version 20261105070000 for connected-role reconciliation. Two bookings with assigned workers no longer show Pending. Request acceptance and team assignment now update the same derived status used by all roles.
- Customers can see their directly assigned team before appointment confirmation. This does not bypass required contracts, verified payments, scheduling or work-start guards.
- Cancelled bookings release active assignment reservations. Closed projects do not block new provider appointments.
- Legacy provider completion submissions now create evidence pending MAZ review; they do not close the booking. MAZ still approves evidence and separately signs off project completion.
- Customer access to private provider photos now requires MAZ-approved evidence. Provider uploaders and MAZ retain access; unrelated customers and pending customer evidence access were checked under the authenticated database role.
- Contract requirements cannot be changed after quotation issuance to alter an already approved payment requirement. The optional-contract shortcut was removed for services marked as not requiring a contract.
- Customer dashboard approval counts now include only contracts/change orders, excluding the retired quotation/schedule response steps. Provider quotation labels now identify MAZ approval; assigned job details include service location and manually recorded customer contact details.

## Verification

- Full automated suite: 683/683 tests passed. After the final provider-detail correction, 67 focused tests passed separately.
- Touched-file lint, design-token checks and production build/TypeScript passed.
- Reusable rollback-only database checks: `supabase/tests/connected_role_workflow.sql`. They require existing demo identities; all inserted records, storage metadata and temporary service policy settings are rolled back. No notification API or real money transfer is invoked.
- Checked the complete no-contract flow: manual booking support; admin-issued quotation; direct assignment; customer team visibility; denial to an unrelated customer; appointment confirmation; work start; provider progress; pending-evidence privacy; MAZ approval; provider completion; MAZ project sign-off; customer turnover; verified final payment; final closing with zero remaining balance.
- Checked the contract branch: temporary chargeable-inspection test configuration; verified PHP 1,500 inspection; inspection findings; PHP 5,000 quotation; automatic PHP 2,500 advance; exactly PHP 1,000 remaining after inspection credit; contract approval; execution confirmation; cancellation releasing workers; refund approval keeping net paid unchanged; actual test settlement reducing net verified paid by exactly PHP 1,000.
- The actual service catalog currently has no chargeable-inspection service. That branch was tested with a temporary configuration inside a rolled-back transaction; actual service policies and prices were preserved.
- Before/after payment-ledger counts, amount sums and refund sums matched during deployment. No real payment, refund, customer decision or completion was fabricated.

## Post-repair database checks

All tested inconsistency counts are zero: assigned-but-Pending bookings, unqualified active workers, overlapping active assignments, active workers on cancelled bookings, duplicate accepted quotes, quote/change-order total mismatches, over-refunds, closed unsettled bookings and duplicate cash/payment mirrors. Manual-customer columns and functions are deployed.

Real gateway charges and external email delivery were not triggered. Gateway/API behavior is covered by automated tests; real transaction settlement and delivery were not live-tested.

## Main-branch integration
The later main-branch Saturday payroll updates were merged with the audited workflows. Both the payroll migration (20261104200000) and the compatibility migration (20261105080000) were validated against the rollback-only role scenarios and applied without creating or paying any payout. Direct assignments, qualified-service filtering, owned completion evidence and MAZ review remain in place. The merged automated suite passed 686 tests.
