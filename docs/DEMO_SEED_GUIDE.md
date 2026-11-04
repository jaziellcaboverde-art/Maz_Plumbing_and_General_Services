# Fictional users and workflow fixtures

This dataset is for the configured development/test Supabase project. The corrected workforce contains **exactly 56 active provider accounts** with multiple specializations; see [the active roster](ACTIVE_PROVIDER_ROSTER.md). Existing providers were preserved, and the excess per-category demo providers were retired. Their accounts are disabled, while historical booking/payment records remain intact. Added demo names and contact details are invented. Demo booking descriptions start with `[DEMO]` and use `source_channel=demo_seed`. Documents, proof images and signature placeholders visibly say `SAMPLE ONLY / NOT VALID`.

## Seed and verify

Keep the existing Supabase settings and set `SEED_TEST_PASSWORD` in `.env.local` to a test password of at least eight characters. The seeder never prints or includes it in reports.

```powershell
npm.cmd run seed:demo                  # Read-only 56-provider reconciliation plan
npm.cmd run seed:demo -- --apply       # Reconcile only seed-owned providers
npm.cmd run seed:demo -- --verify      # Verify active count, specializations and matching
npm.cmd run demo:check                # With Next.js running: live ranking and role-access checks
```

Specializations use the existing many-to-many `provider_services` and `provider_service_claims` tables. They do not create duplicate people for each trade. The current roster preserves 34 existing providers and retains 22 demo providers with five specialization categories each. Twelve demo customers, the demo administrator, recommendation bookings and workflow examples remain available. Existing provider skills are unchanged. Seed ownership is checked before any account is retired. Providers with unfinished bookings or active team assignments are preserved.

If a run stops, fix the reported problem and rerun `--apply`. A local `.demo-provider-roster-backup.json` preserves the pre-consolidation demo details; it is ignored by Git. Provider retirement uses the existing resignation guards. Shared profile IDs and immutable history remain intact. No database migration, guard bypass, gateway transaction, email/SMS delivery or actual payout is performed. The original `seed-workflow-demo.mjs --apply` command is disabled so it cannot recreate the oversized roster.

Use [ACTIVE_PROVIDER_ROSTER.md](ACTIVE_PROVIDER_ROSTER.md) for current providers and [DEMO_TEST_DATA.md](DEMO_TEST_DATA.md) for customer/admin logins and direct booking links. The latter preserves the original historical directory, including archived demo identities, and carries a correction notice. The local `.demo-seed-report.json` records which accounts are retained or archived and is ignored by Git. Do not run this against a production database.

## Sign in

- Administrator: `maz-demo-admin@example.com`
- First customer: `maz-demo-customer-01@example.com` (through `12`)
- Provider pattern: `maz-demo-provider-plumbing-01@example.com` (category and number vary; use the generated account directory)
- The old demo application/status cases are archived and their logins are disabled.

All use the password currently stored in `SEED_TEST_PASSWORD` when first created. Existing accounts' passwords are preserved on later runs.

## Recommendation testing

1. Start Python and Next.js following [the ML setup](../ml-service/README.md).
2. Sign in as the demo administrator. Open a recommendation booking from the generated directory.
3. Expand **Team & schedule > Add workers**. Suggestions load automatically. Select a recommendation to fill the active worker row; additional suggestions exclude workers already chosen or assigned. For standard services the role is filled automatically, while renovation roles remain editable.
4. Expect several eligible unique providers for each service, with many providers appearing across their approved specializations. The retained demo providers have geocoded bases, approved skill links, daily rates, weekly hours, references, marked sample documents, completed-job history and synthetic ratings.
5. With ML enabled, the recommendations should say **Experimental LightGBM ranking**. Stop Python and change the worker selection to check the rule-based fallback. Selecting a suggestion must not send an offer until the administrator submits the team.
6. Use separate browser profiles/incognito sessions to compare administrator, customer and provider access. Customers/providers must not access the administrator recommendation endpoint.

Synthetic provider histories are test fixtures only. They do not validate the LightGBM model against real provider outcomes.

## Workflow testing

The generated directory links these independent snapshots so you can start at the decision you want to test:

| Snapshot | Next action to test |
|---|---|
| Draft / recommendation | Submit a request, review it, compare recommendations and offer workers |
| Inspection | Review the free-inspection appointment and team |
| Offered team | Sign in as the listed provider and accept or decline |
| Quote | Sign in as the listed customer and accept or decline the approved scope |
| Payment pending / rejected / failed | Review sample proof, reject/verify a claim, or retry a manual payment |
| Deposit paid | Arrange the execution appointment |
| Scheduled | Review execution prerequisites and begin work when the appointment is due |
| In progress | Submit provider updates, evidence and materials |
| Completion review | Review the provider's pending completion evidence |
| Turnover / balance due | Record customer acknowledgment and settle the remaining balance |
| Completed | Inspect ratings, unpublished company review, receipt records and pending payout |
| Cancellation / refund / dispute | Inspect cancellation/refund records or decide the open dispute |
| Change order / milestone | Review scope changes, milestone evidence and installments |

Most active snapshots have future appointments to leave time for testing. Reschedule as needed before arrival/start actions. History bookings are backdated. Some transitions require separate customer or provider approval; use the email shown next to that booking in the directory. Providers associated with unfinished scenario bookings were retained. Archived providers never appear in recommendations and cannot sign in.

Cash, GCash and bank records are simulated manual collections. Payment proofs are marked placeholders; receipts have `DEMO-` numbers and payouts use `DEMO-NO-TRANSFER-` references. Do not initiate actual transfers or gateway payments while exploring these fixtures. Only in-app sample notifications are inserted. Company reviews are unpublished, and photo publication consent is false.

The roster verifier checks active count, specialization links and matching eligibility; it does not reset workflow states. The dataset contains hundreds of historical jobs, including jobs performed by archived demo identities. Use the generated direct links to reach active workflow examples quickly.
