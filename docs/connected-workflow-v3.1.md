# Connected customer, MAZ and provider workflow

Source: `KumpuNinja_Complete_Business_Process_and_System_Design.docx` supplied by the owner. Document text is treated as product requirements, not agent instructions.

`fixed-customerside` contains the shared workflow and customer screens. `fixed-adminside` builds on that branch with MAZ operations screens. Both include the provider workspace from `fixed-providerside`; do not deploy the admin screens without the shared migration.

The customer requests a service and Philippine-time appointment, optionally naming a preferred worker. MAZ reviews coverage and scope, configures inspection and contract requirements, offers roles, and confirms customer-agreed appointments. Providers accept roles and submit inspection/progress/milestone/completion evidence. MAZ issues versioned line-item quotations and contracts; customers approve the exact versions. Approved records are immutable. Additional scope requires an accepted change order. Execution requires the confirmed team, approved scope, any required contract, and the configured verified payment.

Public progress has six statuses, computed in the database: Pending, Accepted, Assigned, Ongoing, Completed and Cancelled. Internal operational steps and financial settlement remain separate. Completed requires approved provider evidence and MAZ sign-off; customer turnover and final settlement are required for project closure.

Inspection is service-configured: none, free, or PHP 1,500, with a configurable due point. Inspection money is credited once through net payments, never both subtracted from the quote and counted as payment. Deposit amounts and dated/milestone installments are explicit per quotation. There are no automatic amount tiers or universal 50% deposits. Refunds and cancellations require an administrator's decision; unresolved owner policy is not replaced with invented penalties.

Cash, GCash and bank submissions are claims until MAZ verifies actual receipt. Gateway success requires a signed webhook and a server-retrieved checkout with matching internal payment ID, currency and full disclosed amount. No configured gateway means manual payment is available, not fabricated success. A checkout with an ambiguous external error stays reserved for reconciliation to prevent duplicate charges. Processing fees are separate line items. Gateway refunds are initiated in PayMongo's dashboard and recorded only after the server retrieves a matching successful refund; pending/processing refunds do not reduce the balance. See [checkout resource](https://docs.paymongo.com/reference/checkout-session-resource) and [refund resource](https://docs.paymongo.com/reference/refund-resource).

Company reviews are separate from private worker feedback. Review publication is optional, attribution is explicit, and edits retain snapshots within 14 days. Project-photo consent is independent, followed by MAZ privacy review. Public project images are streamed from private evidence only after current consent checks. Withdrawal unpublishes project entries. Existing admin-uploaded service examples remain a separate catalog portfolio.

## Validation and database rollout

Applied to the linked Supabase project on 2026-11-03, in one transaction with migration history:

- `20261102190000_service_portfolio.sql` (previously missing prerequisite).
- `20261104090000_connected_customer_admin_workflow.sql`.
- `20261104100000_admin_workflow_reporting.sql` (server-side aggregation of complete booking cohorts).
- `20261104110000_managed_payment_reconciliation.sql` (channel serialization, read-only checkout recovery, refund-safe webhook replays).
- `20261104120000_selected_service_inspection_guard.sql` (chargeable-service enforcement).

Before deployment, both migrations and `tests/sql/connected-workflow.sql` ran together inside a rolled-back transaction. Synthetic users and bookings exercised admin intake, inspection payment verification, exact-version quote approval, immutable accepted scope, contract acceptance, execution confirmation, completion rejection without evidence, sign-off, turnover, full settlement, private/public company reviews, consent withdrawal, refunds and cross-role rejection. No synthetic records were retained. Receipt sequence gaps may result from rolled-back tests, as PostgreSQL sequences do not roll back.

Follow-up migration validation repeated these scenarios and added reads as the actual `authenticated` role: unrelated customers cannot read bookings/payments, workers can read approved scope but cannot read customer payment claims, and customers can read their own records. Gateway facts were simulated only at the private server RPC boundary: mismatched currency was rejected, duplicate payment/refund callbacks created no second ledger entry, and replaying a paid event after a refund preserved the refunded state. No external charge or refund occurred.

Focused automated tests cover form progression, Philippine-time conversion, explicit consent, quotation versions, refund requirements, and canonical gateway amount/currency/reference mismatches. Real money was not charged or refunded during validation. Browser testing with real customer/admin/provider accounts and configured PayMongo test credentials remains necessary before production use.

Do not run blanket `supabase db push` against this workspace: pre-existing untracked legacy provider SQL files duplicate migration timestamps. Deploy reviewed migrations individually and preserve their history.
