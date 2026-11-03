# Provider workspace — KumpuNinja v3.1

Implemented against the user-supplied `KumpuNinja_Complete_Business_Process_and_System_Design.docx` dated 3 November 2026. This records local code changes, not a production or database acceptance result.

## Provider experience

- `/provider`: counts for offers, active assignments and submissions awaiting MAZ review; upcoming confirmed appointments and availability guidance.
- `/provider/offers`: existing lead offers plus project role offers, exact dated deadlines, acceptance/decline, and offer history. Accepting availability does not claim the whole team or appointment is confirmed.
- `/provider/jobs`: accepted work; each detail shows the approved MAZ scope, the worker's project roles, milestones, booking messages, inspection findings, progress, issues, change requests and photographic completion evidence.
- `/provider/schedule`: weekly Philippine working hours, dated exceptions, assignment blocks and offer holds. `/provider/availability` opens the same tool. Providers cannot move confirmed customer appointments.
- `/provider/job-updates`: submitted evidence and MAZ review decisions. Retry keys preserve saved submissions after a connection failure.
- `/provider/history`: finished work and separate private worker feedback. A crew member can finish their phases while the parent renovation remains active.
- `/provider/earnings`: own MAZ payout records, separate from customer payments.
- The public application wizard now orders account/location, skills/experience, then documents/consent/security check. Existing private application uploads and admin activation remain in place.

## Operations and access

`/admin/provider-work-updates` supplies the necessary counterpart: offer multiple trade/phase assignments, review evidence, request corrections, record replacement plans, confirm the requested appointment, issue MAZ quotations with explicitly configured deposits, add work milestones, and approve final project completion.

Assignment creation/acceptance uses a shared transaction lock per worker and checks qualifications, dated leave, weekly hours, existing work, other live offers and travel buffers. Offers have an administrator-selected deadline 24–48 hours away. The scheduled worker period follows the offer deadline. The initial inspection may use the requested appointment. New execution periods and revised inspection periods create customer-visible proposals; the customer must accept the corresponding work periods before MAZ confirms execution. A response records consent without moving the confirmed booking automatically.

Existing lead-offer history is retained. Legacy automatic replacement calls now return to the admin queue. Direct provider quotation, scheduling and completion RPC privileges are removed. Provider completion evidence never closes the parent booking. Admin sign-off checks the lead's approved evidence, the required trades, other team assignments and project milestones. Payment settlement remains separate.

Private feedback uses a new table with access restricted to its author, relevant worker and administrators. Existing reviews are not copied or reclassified. Completed customer booking pages offer optional private feedback only for workers who actually performed that booking. Customer receipt storage is restricted separately from shared project evidence. Customers can see MAZ-reviewed inspection/progress/milestone/completion updates within their own booking; internal issues and additional-work proposals stay in MAZ review.

Additional-work submissions are proposals only. Reviewing evidence is not a versioned customer-approved change order and does not authorize extra charges. Provider screens explicitly require MAZ and customer approval before additional work starts.

## Database rollout

On 3 November 2026, the user authorized applying the database changes. The app's configured Supabase project was verified against the CLI project reference. Both `20261103090000_provider_workspace_prerequisites.sql` and `20261103100000_provider_workspace.sql` were validated in a rolled-back transaction, then committed together with their migration-history records. The prerequisites consolidate the four provider migrations absent from this deployed database under a unique version. Existing customer/job data was preserved, and the PostgREST schema cache was reloaded. The application itself was not deployed.

The checkout already contains duplicate migration timestamps around 29–30 October. Reconcile the target database's migration history before using a blanket migration push; existing migration files were not renamed. Configure the existing `/api/jobs/expire-offers` worker with `CRON_SECRET`; it now expires project-role offers and notifies administrators as well.

Do not infer a production-ready payment/contract/change-order rollout from this provider work. Chargeable inspection service selection, fee due dates, refund/cancellation policy, contract approval and the broader versioned change-order/payment-ledger workflows still require their corresponding system work and owner policy. No universal 50% deposit or automated cancellation penalty was introduced here.

## Verification

- Final TypeScript checking passed (`npm.cmd run typecheck`). All 30 focused tests passed, including independent assignment completion.
- Focused tests cover application order and validation, navigation, Philippine-time conversion, request validation/authentication, submission retry keys, failure isolation for notifications, weekly-hour validation, independent team completion and separate customer appointment consent.
- Last full regression run: 473 passed and 8 failed. The remaining failures concern existing global design tokens, duplicate migration timestamps, an old test asserting that the admin configuration page does not exist, and existing focus/animation styles. New provider CSS adds no raw color/size tokens.
- Production build was attempted and stopped when the existing root layout's Inter font could not be downloaded from Google Fonts in this environment.
- After database deployment, all new provider tables, the provider booking/service join, admin provider/profile join and milestone query passed real database API checks. Read queries under an approved provider's authenticated role passed for legacy/team offers, bookings, availability, weekly hours, assignments, submissions, private feedback and payouts.
- Simultaneous assignment acceptance, complete authenticated browser journeys, cross-account isolation, signed storage access, worker delivery and payment/appointment transitions still need end-to-end testing. Successful schema and read-access checks do not establish those guarantees.

Before release, exercise: overlapping concurrent offers; expiry followed by replacement; an inspection followed by execution; a four-worker project where only one withdraws; a declined completion returned for corrections; parent sign-off blocked by an unfinished trade; zero-deposit and explicitly configured deposit quotes; unrelated-provider access denial; private feedback hidden from other workers and public users.
