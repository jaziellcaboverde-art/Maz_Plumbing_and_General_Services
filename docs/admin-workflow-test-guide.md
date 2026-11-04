# Test the connected workspaces

Use `fixed-adminside` to test customer, admin and provider together. It includes `fixed-customerside` and the earlier provider workspace. The customer branch keeps customer screens and shared database/API changes separately reviewable. Neither branch bypasses protected `main` review requirements.

The DOCX's business requirements drive the implemented flow. MAZ must supply real service-specific inspection policies, payment instructions, fees and project terms. No bank or wallet account, cancellation penalty or universal deposit percentage has been invented.

## Manual acceptance scenario

1. Admin: open `/admin/config`; configure selected inspection services and verified MAZ payment instructions. Edit the service catalog through `/admin/services`.
2. Customer: submit the four-step service request. Choose a requested Philippine-time appointment and optionally an alternate time or preferred worker. Submission is Pending, not a confirmed date or provider selection.
3. Admin: open the booking from `/admin/bookings`. Review the request and applicable inspection/contract requirements. Under **Team & schedule → Add workers**, add each worker and their role. Set the phase and response deadline (the recommended deadline is 36 hours), then choose a duration, available date and available time. Only shared availability for all selected workers is shown; leave, assignments, active offer holds and travel buffers are excluded. Send the offers. The final server check prevents overlapping offers if availability changes before submission.
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

## If “Accepted lead provider” has no choices

An offer is not an acceptance. Each assigned worker must sign in to their own provider account, open **Offers**, and accept the role. The admin booking shows who is still pending and refreshes automatically; **Refresh team and approvals** also updates it immediately. Only approved workers with an accepted role for the current phase can be selected. Valid accepted leads from the older offer flow remain supported. If there is one eligible lead, it is selected automatically. Inspection acceptance alone does not make a worker an accepted execution lead.

The confirmation panel lists other prerequisites, including MAZ review, customer quotation/contract approval, configured payment and customer date agreement. Existing confirmed appointments are shown as confirmed instead of presenting another required empty selector.

## UI checks: admin, customer and provider

- Admin: filter bookings, clear filters, expand a booking section, add multiple workers and check the confirmation requirements. Pending payment claims, evidence and customer requests should open for review.
- Customer: check the next step, approve an issued quotation or document, review proposed dates and open payment or support sections. Required approvals remain visible; history is collapsible.
- Provider: review offers, open an assignment, send evidence and check MAZ decisions. Update regular working days and dated exceptions on the schedule page. Check history, earnings and payout details.
- Test at desktop and phone widths. Inputs, labels and buttons should stay within the screen. Use Tab and Enter to check focus, section summaries and forms. Expand **Field guide** when you need more detail; samples remain in the text boxes.
- After a failed evidence submission, retry the same submission. Its notes, milestone and photos stay locked until the result is confirmed, preventing duplicate uploads and mismatched retries.

The original validation notes above describe the earlier implementation. The UI cleanup also resolves the token scan, keyboard focus, decorative animation and outdated token-count checks. Legacy SQL sources are retained in `supabase/legacy-migrations` outside the active migration runner.

### Latest UI validation

- Production build and TypeScript: passed. ESLint and token checks: passed.
- Full suite: 507 tests passed, zero failures. Source scans now reuse one snapshot to avoid repeated disk reads during tests.
- Desktop (1440px) and phone (390px) previews: no horizontal overflow or browser runtime errors. Multi-worker controls and collapsible sections were checked in a temporary sample page, which was removed afterward.
- Public Sans is loaded locally from the root layout for the home page, admin, customer and provider. Production checks confirmed the same loaded family for public headings and form controls; conflicting serif and monospace overrides were removed.
- Existing palette definitions are unchanged. Booking sections have decorative icons; field examples remain available. No commit or push was made.
- Prerender regression: booking form and live tracking render without reading `Date.now()` or constructing a current date. Client callbacks supply the clock after hydration; notification ages use the load timestamp. The focused booking, job-day and team suite passed 19 tests after this fix.

## Simplified booking page

Follow **Next step** at the top. The working sections are:

- **Team & schedule:** send worker offers, choose available schedules and confirm the appointment. Worker responses and customer date agreements are inside this section.
- **Quote & approval:** prepare the price and scope; issue a required contract or extra-work approval when needed. Previous versions remain available in collapsed details.
- **Payments & requests:** verify received funds and handle customer requests or refunds. This section appears only when there are records to review.
- **Work & completion:** review worker updates, start work, approve completion and close the paid booking. Work checkpoints are optional.

Activity history is collapsed. Empty sections and receipt headings are hidden. These layout changes retain the required server approval gates.

If no available schedule appears, have the provider save **Schedule → Weekly working hours** or an **Available** dated exception. Unavailable/leave periods override availability. Try another duration or the next 14-day range. Selecting another worker, deadline, duration or travel buffer invalidates the old schedule selection. Providers with no published availability are not assumed to be available all day.

Availability validation: the read-only search migration was applied after rollback-only SQL checks for team intersection, leave, conflicts, travel buffers, dated availability, work duration and administrator access. Full suite after the schedule picker and simplified admin UI: **520 passed, zero failures**.

Production build, TypeScript, ESLint and token checks passed. A live authenticated admin booking preview passed at 1440px and 390px with no horizontal overflow or browser runtime errors. The live availability API returned HTTP 200; the temporary test admin account was removed. No offers were sent and no real booking was changed during that check.

The shared chat loader now waits for request time before authentication/SDK initialization, including background route prefetches. The focused UI, availability and chat regression suite passed 18 tests. A production admin chat check loaded successfully with zero clock errors; its temporary account was removed and no messages were sent.

## Role overview UI redesign

Branch: `redesign/role-ui-overviews`. This section records the redesign and its local validation.

All roles share the navy sidebar, MAZ header, local Public Sans font, summary tiles and bordered content panels. The reference images guide the layout; live records and existing workflow rules determine the displayed values and available actions.

- Admin: review dashboard queues, filter bookings, and open a booking from its table. Existing team, quote, payment and completion actions remain in booking details.
- Customer: check dashboard updates, filter bookings, follow projects, view verified payments/receipts and open completed bookings to review MAZ. The service request still uses Service, Location, Schedule and Review steps.
- Provider: review offers, open assignments from the table, inspect payout history and navigate the month calendar. Offer holds are tentative; weekly availability and dated exceptions retain their existing save actions.
- Phone: the existing primary tabs and More menu remain available. Booking tables stack into labeled records; all action links remain accessible.

Regression suite: 522 tests passed, including calendar navigation and Philippine-date placement. Authenticated browser checks use temporary accounts and do not send offers, change bookings or submit payments.

Final verification: production build/TypeScript, ESLint and token checks passed. All 21 checked admin, customer and provider pages loaded at 1440px and 390px without horizontal overflow or JavaScript page errors. Profile/settings, booking creation and admin management pages now wait for request time before authenticated SDK initialization; the final preview had no prerender clock warnings. Eight focused calendar/request-boundary tests passed after these fixes. Temporary accounts and preview files were removed.

### Sidebar and page-loading stability

The saved sidebar width is applied before first paint. Mounting the workspace no longer overwrites the saved preference, and blocked browser storage no longer crashes the toggle. Page content has its own loading boundary inside the shared shell.

Validation: 40 focused tests, production build/TypeScript, ESLint and token checks passed. Authenticated checks for all three roles held external application scripts until the server-rendered layout appeared: the collapsed main area stayed at the same 80px position before and after hydration. Header and workspace nodes stayed mounted during menu navigation; toggles worked, phone layouts had no horizontal overflow, and no browser runtime errors occurred. Idle dashboard checks did not reproduce continuous blinking.

### Faster local testing

`npm run dev` compiles routes on first use. For workflow testing, use `npm run preview` to build once and start the optimized application on port 3000. Use `npm start` to restart an unchanged successful build; rebuild after code edits. These commands use the same database and do not deploy the application.

The shared shell and workflow pages now reuse verified identity/profile reads within each server request through React `cache`. Provider layout/page access checks also share their request-local result. No identity data is cached between requests or users, and provider approval/role checks remain enforced.

Validation: production build/TypeScript and ESLint passed; all 534 tests passed. Warm dashboard server responses measured approximately 0.4–0.6 seconds on the local preview. Six authenticated dashboard/list browser checks showed their headings in approximately 0.6–1.4 seconds, without runtime errors or per-page compilation. These timings depend on the machine, network and database. The optimized preview was left running at `http://localhost:3000` for testing.

### Visual polish and grouped navigation

The navy/blue main palette and Public Sans remain unchanged. Metric cards use semantic icon backgrounds, status pills retain their text with decorative icons, and panels/tables/buttons share softer borders, spacing and shadows. Empty detailed admin queue panels are hidden while their summary counts and queue links remain available.

Related desktop destinations now share expandable parent menus:

- Admin **Bookings**: All bookings, Assignments, Create booking.
- Admin **Provider work**: Work updates, Schedules.
- Admin **Providers**: Provider directory, Applications.
- Customer **Bookings**: My bookings, Service History.
- Provider **My work**: Offers, Assignments, Job updates, History & private feedback.

The current page opens its parent automatically. Menu buttons support keyboard navigation. Phone tabs retain all four primary destinations plus More; supporting submenu links are grouped on the More page. All existing destination URLs are preserved.

Validation: 538 tests passed, followed by 32 focused navigation tests after final cosmetic fixes. Production build/TypeScript, ESLint and token checks passed. Authenticated desktop/390px phone checks passed for all roles, including parent toggles, child links, active state, five visible phone tabs, More links, no stray list markers, no horizontal overflow and no browser runtime errors. The latest optimized preview is running on port 3000.

The sidebar brand and collapse control now share a fixed masthead above the independently scrolling menu. Chevron controls have 44px targets; expanded/collapsed behavior and phone layouts were verified for all three roles. The public Sign up text is explicitly white in light/dark and hover states. Build, lint, token and focused layout checks passed after this update.

Admin navigation uses **Schedules** instead of Calendar. Navigation actions throughout the three role workspaces now share a bordered button treatment with a decorative arrow, replacing plain underlined action text. The same component covers payment-proof, document-preview and map actions while preserving their targets and new-tab behavior. Inline contact/legal links retain their contextual meaning.

Action-control verification: 538 tests passed, plus five focused booking UI checks after the document/proof refinements. Build/TypeScript, ESLint and token checks passed. The 27-page authenticated desktop/phone review found no plain underlined action links in the checked views, horizontal overflow or browser runtime errors. Preview remains on port 3000.

## Booking tabs and overview modules

- In admin Bookings, open a request. Its details should open over the list. Switch between Review request, Team & schedule, Quote & approval, and Activity history when those sections are applicable. Only the selected section is visible; unsaved input stays intact when switching tabs.
- Open a customer booking or provider assignment from a list. Close or press Escape to return to the same list. Back closes the popup; a direct detail URL still supports refresh and sharing.
- Open an overview module such as customer quotation/support or provider work progress/weekly hours. It opens in a dialog. Secondary modules use tabs inside the current popup; only one dialog may be open.
- Provider Assignments includes Active assignments, Work history, and Work updates as local tabs.
- Dashboards no longer repeat the supporting sidebar shortcuts at the bottom. Verify title, body, label and button sizes at desktop and phone widths; all roles share the same font scale and blue/navy palette.
- Existing role/ownership checks, approval requirements and payment/workflow actions continue to apply. UI checks should not submit live financial or booking changes.

Profiles render directly on the page for all three roles. Display and password settings keep overview launchers. Admin business configuration opens payment-instruction and inspection-policy modules in dialogs. Final verification: production build and TypeScript, lint and token checks passed; the full suite passed 541 tests, followed by 9 focused booking/module tests after the final tab-selection adjustment. Authenticated desktop/mobile browser checks passed for all three roles, including secondary module tabs in one dialog, direct detail URLs, profile/settings, provider work tabs and weekly hours, and admin configuration. No booking or payment data was submitted.


### Latest UI corrections

- Profiles stay inline for admin, customer and provider.
- Provider weekly hours and availability exceptions use overview cards with action buttons.
- Customer history and new-request links have explicit intercepted routes, so their names cannot be interpreted as booking IDs. Check both a normal menu click and direct URL reload.
- Secondary modules, including confirmations, render as tabs in the existing dialog. Check deeper modules and return through Overview; the visible dialog count must stay one.
- Provider work history and updates remain in Assignments tabs and are removed from desktop and More menus. Other navigation destinations remain available.
- Admin Needs attention retains four counts and destinations as full cards in the same section.
- Unopened modules and unvisited tab forms defer mounting; visited tabs preserve drafts. Provider job reads and profile identity checks are deduplicated within the current request only. No shared cache is used between users.

Final correction checks passed: production build/TypeScript, lint/token checks, the 544-test regression suite before the last performance follow-ups, and focused deferred-mounting/request-identity checks afterward. Authenticated browser checks passed for all roles at desktop/phone widths: inline profiles, explicit history/new-request routing, one dialog with secondary tabs, provider cards and menu cleanup, and four admin Needs attention cards. The final localhost:3000 optimized preview rendered the tested profiles in approximately 0.5�1.5 seconds. No booking/payment forms were submitted. Preview mode uses the built code; use npm run dev when live code editing is needed.

### Admin booking structure and popup positioning

- Admin booking summaries live in an Overview tab. Review, team/schedule, quotation and activity sections display their own content without repeating the summaries above them.
- Request dates, address and MAZ decision are grouped; payments use labeled value rows and a compact expandable breakdown. Activity entries use readable labels and timestamps.
- Assignment cards separate trade, booking reference, status, work phase and schedule. Response deadlines appear only for offers that still need a response.
- All native dialogs use the shared Modal. Service-catalog details and applicant document previews have been migrated. The dialog stays within the dynamic viewport, keeps its header/close outside the scrolling content, and resets content scroll on opening or switching secondary modules. Notification popovers also have viewport limits.
- Validation: production build/TypeScript, lint/token checks and 27 focused tests passed. Browser checks passed for admin, customer and provider at 1440x900 and 390x700, including opening details from a list, scrolling long content with a visible close control, secondary tabs, Escape, and service status-menu behavior. Document previews use the same shared frame; no document fixture was opened in the final browser run. No booking, service or payment records were saved.

### Role cards and direct detail tabs

- Admin request cards show service name, request description and submitted date. Customer request cards and provider work cards share the same layout, with booking reference and confirmation/schedule status. Clicking any card keeps its existing detail destination.
- Customer booking and provider assignment sections are direct local tabs, including provider project roles, work progress and submissions. Conditional workflow gates still apply.
- Root dialogs render in document.body and use the native modal top layer, keeping headers below the popup. Secondary modules stay as tabs within the same dialog.
- All role settings use display/password overview cards. Provider payout details and customer saved addresses use matching cards. Profiles remain inline.
- Validation: production build/TypeScript, lint and design-token checks passed; 47 focused tests passed. Authenticated desktop and phone checks cover cards, detail tabs, settings, one-dialog behavior and header overlap without submitting booking/payment changes.

### Unresponsive-page and history-navigation fixes

- Route popup Close releases the native backdrop immediately, including while Back navigation is pending. Repeated close events do not navigate twice.
- Preserved routes close native dialogs when hidden and reopen them when reactivated through Forward. Dashboard modal slots explicitly render nothing for each role root.
- Logout clears only the current session and navigates to login as a new document, avoiding concurrent replace/refresh requests with stale protected-route state.
- Removed the internal Operations status from admin booking headers. The official status badge and actionable next step remain; workflow rules still use the underlying status.
- Browser regression checks: all three roles at desktop/phone widths; repeated popup open/close, tabs, Escape, Back/Forward, restored clickable controls and logout, with no browser runtime errors or failed requests. No booking/payment data was changed.

### Navigation, services and action-feedback cleanup

- Every role keeps Messages in the header and Profile in the sidebar/phone More page. Redundant sidebar Messages and header Profile controls are removed.
- Customer primary navigation is Dashboard, My bookings, Service History and Services. Projects, Reviews and Book a service no longer have sidebar entries.
- Service History is a normal page at /customer/history. The old intercepted history link redirects there; /customer/reviews redirects to its reviews section. Completed services and review forms share one booking query and the existing company-review form/14-day editing rules.
- Services use an aligned responsive card grid with category labels, booking actions and details for live catalog entries. Book links retain the selected service ID when available.
- Booking filters have a responsive four-field layout. Next Form submits filters through client navigation, and Clear resets the inputs without replacing the workspace. Status labels and selected values remain correct.
- Shared dropdown arrows cover inline forms and portalled dialogs. Create/Add actions use plus icons; booking actions use a calendar-plus icon.
- All role shells have one shared toast provider. Successful workflow mutations and inline success messages provide visible confirmations. Dialogs render their confirmation viewport inside the native top layer; no second dialog is opened. Notification updates also confirm success.
- Notification pages and the header panel share card treatments, clear actions, timestamps, Close/Escape and outside-click dismissal.
- Preserved local copies: 658 duplicate (2) files moved into Maz_Plumbing_and_General_Services-main/duplicate-backup-20261104. Another 21 unused, unintegrated source/test copies were moved into its unintegrated-source-backup-20261104 directory. Both remain available locally, outside active compilation. Existing unrelated provider/completion API drafts and portfolio images were kept.
- Validation: 550 regression tests, build/TypeScript, changed-source lint and token checks passed. Desktop/phone browser checks covered all three roles, filters and Clear, normal history navigation, review integration, service card alignment, notification UI and success feedback inside one dialog. Notification mutations were mocked and other browser-test database writes were blocked.
- Latest optimized preview runs on localhost:3000. Use npm run dev after stopping it if live editing is needed. These changes have not been committed or pushed.

Service-card booking update: per-card booking actions are icon-only calendar-plus links with service-specific accessible labels/tooltips. Customer cards use the actual active-service query so every card has a bookable service ID. The new-booking popup resolves that ID and remounts its form when a different service is requested. Legacy fallback-name links resolve only to an unambiguous active service; explicit drafts keep their saved selection. Build/TypeScript, lint/token checks and four selection tests passed. Desktop/phone browser checks opened three different cards each and confirmed the selected service matched, with one dialog, no runtime errors and zero database writes. Changes remain uncommitted.

## Direct enrollment of existing MAZ providers

Open Admin > Providers > Provider directory > Add providers.

- Manual: add one or several provider rows, select their approved services, then review and confirm. Up to 100 providers per batch.
- CSV import: download the template, fill it out, upload it, review the rows, then confirm. Required columns: first_name,last_name,email,mobile,services. Optional columns: daily_rate,service_area,password.
- Separate multiple services with |. Use the exact service names shown in the importer, service IDs, or Category::Service name for ambiguous names.
- Leave password blank to generate one. After successful creation, download the sign-in details text file before navigating away. Workers can change their password after signing in.
- These existing workers receive approved provider accounts and approved service qualifications immediately; no application is required. Availability and payout details can be completed after sign-in.
- Existing email addresses are rejected without changing their accounts. Invalid rows show errors before submission. The importer submits valid rows in batches of 10 and reports each result.
- Review remaining rows retries only failed or previously unsubmitted rows. For an uncertain result, check the directory first to avoid duplicate submissions.

Validation: 591 automated tests passed, production build and token checks passed. Desktop and mobile browser checks covered manual multi-add, CSV preview, batch requests, partial failures, downloads, and a single dialog. Browser successful creation responses were mocked; real endpoint checks verified customer/provider denial and invalid-row rejection without creating accounts.

Main integration verification (2026-11-04): merged the latest portfolio, provider schedules and reports from origin/main with the role UI and direct provider enrollment updates. Production build/TypeScript and lint for the touched integration components passed. The merged suite passed 610 tests; three existing upstream checks still fail: raw design tokens in the new reports/schedules, a removed focus outline in provider schedules, and the changed radius-home-circle token. Those upstream files/token values were preserved. Service cards retain portfolio links plus a separate icon-only action that preselects the service for booking.

## Automatic search and filters (uncommitted)

- Admin/customer booking filters apply automatically: search waits 400 ms after typing pauses; status and date changes apply immediately. Navigation replaces the filter URL and keeps scroll position. Clear cancels a pending search and resets the fields.
- Admin booking search now matches customer first/last names as well as descriptions and full booking IDs. Name words can match across first and last names; status/date filters and pagination still apply.
- Customer directory and audit log search/date filters now apply immediately without a Filter button. Existing stage/action filters remain automatic.
- Service catalog search has category and active/inactive filters. Project search has status and service filters. Shared chat search has All, Unread, Bookings and MAZ Support filters for all roles.
- Existing provider-directory role filters, provider-schedule service filters, report period filters and status tabs remain automatic.
- Validation: production build/TypeScript and focused lint passed. Authenticated browser checks passed for all three roles at desktop and phone widths, including real customer-name booking search, automatic dates/status, Clear during a pending search, and chat filters. No business records were submitted in these checks.

## Quotation, contract, work approval and stability cleanup (2026-11-05)

- Quote & approval separates Quotation, Contract and optional Additional Work. Approved quotes show an immutable version summary and actual approval timestamp; revisions are issued as new versions. The quotation form has a review step before sending.
- Contract fields open on demand and contain scope, responsibilities, schedule, payment terms and optional warranty. Extra-work cost/days appear only in the separate extra-work form. Existing document versions, offline decisions and customer approval APIs are preserved.
- Payment presentation separates approved total, verified payments, remaining balance, configured upfront requirement and currently due. Inspection credit is shown as part of verified payments and is not subtracted twice. No universal 50% deposit is introduced.
- Next action uses the real quotation, contract, payment, team, inspection and evidence state. Start/completion controls show missing requirements; database authorization and execution/completion guards remain authoritative. Multiple workers, replacements, checkpoints, evidence review and turnover remain available.
- Restored and integrated the project's provider recommendation components with the existing team offer flow. Obsolete requests are cancelled and selection changes do not send assignment offers automatically.
- Moved 1,535 numbered duplicate files to the excluded local duplicate-backup-20261105 directory, preserving originals and all unique new files. Added duplicate exclusions to Git, TypeScript and ESLint. Background refresh pauses for hidden tabs and focused forms and avoids overlapping refresh transitions.
- Centralized existing schedule/report style values, restored keyboard focus and circle tokens, without changing the main palette.
- Actual Admin Bookings error: the deployed database does not yet have bookings.manual_customer_name. The listing retries only that specific missing-column error using the previous schema; profile-name search and filters are preserved. Permission and unrelated database errors remain visible. Manual-customer schema deployment is still required for the newer manual booking creation feature.
- Verification: production build/TypeScript, lint and design-token checks passed; 661 tests passed in the full run. One existing migration-timestamp test still fails because admin_manual_customer_bookings and managed_payment_reconciliation share version 20261104110000. Those existing migrations were not rewritten or applied. The later booking fallback and approval checks passed separately. Authenticated desktop/mobile dashboards and the existing Aircon demo were reviewed without modifying records; first dashboard loads measured approximately 0.8-2.4 seconds in preview mode.
- Final Admin Bookings browser verification passed at desktop and phone widths against the live older schema, including automatic customer-name search. Final mobile approval panels use full-width cards and inline forms, with no nested dialogs. The final production preview is running on localhost:3000. No commit or push was made.

## Direct assignments and receipt import (2026-11-05)

- Admin worker assignment lists approved providers linked to the booking service. Select several workers and Assign: provider acceptance, expiry, travel-buffer and duration inputs are no longer required.
- The database uses a customer-approved/requested appointment if available. Otherwise it finds the next shared available one-hour visit within 30 days. Changed dates and execution appointments still require customer agreement before MAZ confirmation. Availability exceptions, weekly hours and other assignments remain authoritative.
- Assigned workers are selected together in MAZ appointment confirmation. The first selected worker remains the primary contact; all selected workers are checked again for availability. Customer quote/contract approval and verified payment requirements still apply.
- Existing unanswered offers are historical. Admin can select those workers again to replace a previous offer with a direct assignment; no provider acceptance action is needed for new assignments.
- Quotation: download public/samples/quotation-receipt.csv, replace the expense rows, keep the headers description,amount and put TOTAL in the final row. Import CSV (64 KB maximum, 1-30 expense rows); the total must exactly match the expense sum. Review before sending. Manual item entry, scope/duration, Payment terms and checkout fee inputs were removed. New imported quotes have zero processing fee; historical approved quotes are preserved.
- The server reparses the imported CSV and derives items and total; client-submitted line items/fees cannot override it. Imported items and receipt filename remain in the versioned quotation. PDF/image OCR is not part of this CSV import.
- Applied database migration 20261105020000_direct_provider_assignments atomically to capstone-phase-2 after successful rolled-back runtime/authorization/idempotency checks using demo records. The checks sent no notifications and retained no test assignments. No GitHub commit or push.
- Final verification: 39 focused tests passed; production build/TypeScript and touched-file lint passed. Updated optimized preview is running on localhost:3000.

## Automatic contract down payment (2026-11-05)
- New quotations automatically require 50% of the imported subtotal when Contract required is selected in Review request; otherwise the down payment is zero. No amount input or custom installment entry is needed. Remaining payment is due after MAZ completion approval; verified inspection payments remain credited.
- Applied migration 20261105030000 after rolled-back demo tests confirmed 50.51 on a 101.01 contract subtotal and zero without a contract, even with a forged client deposit. Existing approved quotes and verified payments are preserved. 16 focused tests passed. No commit or push.

## MAZ-approved assignments and quotations (2026-11-05)
- Issuing a quotation now approves it under the MAZ administrator account. Assigned work periods are authorized by MAZ; no customer quotation/schedule response is required. The admin warnings and Refresh team and approvals button were removed; customer quotation and appointment acceptance buttons were removed.
- Existing valid unexpired MAZ-issued quotations and pending periods matching active assignments were activated with a policy audit entry. Declined, expired, completed and previously accepted quotation records were preserved. Required contract approval, verified payments, provider availability and completion controls still apply.
- Applied migration 20261105040000 after a rolled-back demo check successfully issued a quotation, assigned a provider and confirmed the execution appointment without any customer/provider acceptance. 19 focused tests passed; no test records or notifications were retained. No GitHub commit/push.

## Confirmation phase and Team & schedule cleanup (2026-11-05)
- Confirmation now uses the same phase rule as the admin UI: execution for services without an inspection requirement, after approved inspection findings, or with an issued quotation. An existing execution assignment without pricing reports the actual missing MAZ quotation instead of incorrectly claiming the worker is unassigned. Workers remain directly assigned throughout.
- Removed redundant proposal/customer-response rows and standard automatic-assignment notes from Team & schedule. Renamed the list Assigned workers. Historical appointment records remain available in Activity history. Assigned work periods and release/replace controls remain available.
- Applied migration 20261105050000 after a rolled-back test against the affected booking. No assignments were released or changed; no commit/push.
