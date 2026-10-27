# architecture-notes.md

---
## AI RULES — READ FULLY BEFORE ANY ACTION
---

1. Read this entire file before proposing any structure, modifying
   any file, or debugging anything.
2. Project scale drives everything. Read the Scale field first.
   Do not propose a structure that exceeds what the scale requires.
3. Before touching any file → identify all files connected to it.
   This map is your reference. If a connection is not listed here,
   find it before proceeding — do not assume it is isolated.
4. If the structure evolves during the build → update this file.
   An outdated map is worse than no map.
5. Never create folders or layers that the current scale does not
   justify. Do not over-architect small projects. Do not under-
   structure large ones.

---
## SCALE — READ THIS FIRST
---

**Project Scale:**
[ ] Small — single purpose, few screens, one developer
[x] Medium — multiple features, growing complexity, needs modularity
[ ] Large — multi-module, many contributors, long-term maintenance

**Scale Guidelines the AI must follow:**

Small → near-flat structure. Minimal subfolders. Group only what
        genuinely needs grouping. No layers for their own sake.

Medium → feature-based grouping. Each feature owns its files.
         Shared utilities in one place. Clear separation of concerns
         without over-engineering.

Large → fully modular. Domain-driven. Each module is independently
        navigable. Explicit dependency boundaries. Documented entry
        points for every major section.

---
## PROJECT REFERENCE
---

**Project Name:** MAZ Plumbing and General Services

**Project Type:**
Responsive web app, mobile first, with three roles (customer, provider, admin). Home services booking platform for the Philippines.

**Tech Stack:**
- Frontend: Next.js 16.4.2 (App Router) with React 19.3.0 and TypeScript 5. Plain CSS modules and design tokens, no Tailwind (decision-log.md #8). Versions as in package.json on 2026-10-17
- Backend: Next.js server actions and route handlers, plus Supabase for data logic (SQL functions, RLS, realtime)
- Database: Supabase Postgres with PostGIS. All schema as SQL migration files in the repo
- Auth: Supabase Auth, email and password with verification. Owner deferred mobile OTP and paid SMS (Q19, decision-log.md #17)
- Other:
  - Email: Brevo (transactional API and Supabase Auth SMTP)
  - SMS: deferred; do not configure or send SMS until the owner approves a budget and provider
  - Payments: PayMongo (test mode until Phase 17)
  - Map: Leaflet and react-leaflet with OpenStreetMap data; Geoapify provides hosted tiles and geocoding (Q14)
  - Signature: signature_pad
  - Validation: zod
  - Storage: Supabase private buckets with signed links

**Dev environment (checked 2026-10-16):**
- Windows, VS Code
- Node v24.22.0 (LTS), npm 11.19.1, Git 2.56.0.windows.2

**Entry Points:**
- src/app/layout.tsx: root layout. Sets the font, the font size init script (decision-log.md #9) and imports globals.css
- src/app/globals.css: imports src/styles/tokens.css and src/styles/font-size.css, holds the focus ring and reduced motion rules
- src/app/(public), (customer), (provider), (admin): one layout per role, each wraps its pages in a shell from src/components/layout. Role paths are /, /customer, /provider, /admin
- src/app/dev/components: review page for the base components. Not available in production
- scripts/check-tokens.mjs: the token check (npm run check:tokens)

**Folder Structure:**
Current state (2026-10-17, end of Phase 1). Planning files sit in the project root, next to the app:
- architecture-notes.md
- constraints.md
- decision-log.md
- open-questions.md
- project-brief.md
- project-handoff.md
- README.md
- ux-ui-guidelines.md
- phases-plan.md (keep with the others)
- design plan.md (approved 2026-10-17)
- src/app (route groups per role, root layout, globals.css)
- src/components/layout (shells, role nav, nav config) and src/components/ui (base components, one CSS module each)
- src/lib (font size engine, class name helper, server-only notification dispatcher and email template in notifications/)
- src/lib/location and src/components/location (coordinate checks, address search, map picker, and location states)
- supabase/migrations: Phase 2 schema and RLS through `20261017121200_site_inspection_cancel_guard.sql`; Phase 3 retry log and claim function in `20261018130000_notification_delivery_retry.sql` (applied to the linked Supabase project on 2026-10-18)
- supabase/SETUP.md (owner steps: create project, link, push, keys, email templates)
- scripts/seed-test-data.mjs (npm run seed:test) and scripts/check-rls.mjs (npm run check:rls)
- src/proxy.ts (route guard, runs before every page), src/lib/auth/roles.ts, src/lib/auth/route-access.ts (pure rules)
- src/lib/supabase: env.ts, browser.ts, server.ts, admin.ts (service role, server only), session.ts (proxy helper)
- src/app/(public)/login, forgot-password, reset-password, link-expired and src/app/auth/confirm/route.ts (email links)
- src/app/api/location (server-side geocoding, country validation, PostGIS saving, provider search, arrival and override routes)
- supabase/migrations/20261019140000_location_and_arrival.sql (Phase 4 location functions and arrival override request queue; apply after review)
- tests/route-access.test.ts, tests/database-migrations.test.ts
- tests (unit and component tests, token and shell checks)
- src/styles/tokens.css (all design tokens, the only file with raw values)
- src/styles/font-size.css (root size per level)
- src/lib/font-size.ts (levels, cookie, init script)
- src/components/ui/font-size-control.tsx (text size setting, reused in Settings)
- scripts/check-tokens.mjs (run with npm run check:tokens, fails on raw colors, sizes and radii in src/components and src/app)
- tests/check-tokens.test.ts (tests for the check script and a run over the real project)
- tests/step-1-23.test.tsx (header identical in every shell, focus visible, reduced motion respected)

Feature folders are created in their own phase (phases-plan.md step 1.6). The folder structure was approved by the owner in step 1.2.

**Module / Feature Map:**
- Foundation and design system → Responsible for: tokens, font size engine, layout shells, base components
- Database, auth, roles → Responsible for: schema migrations, RLS, route guards, storage buckets
- Map and location → Responsible for: map component, pin, address search, distance function, arrival check
- Accounts and onboarding → Responsible for: sign up, provider application, admin approval, settings, consent
- Services and booking request → Responsible for: service catalog, booking stepper, drafts, booking list
- Matching and offers → Responsible for: reliability score, recommender, offer chain, timers, admin queue
- Quote, inspection, deposit → Responsible for: quote, class and tier, milestones, PayMongo deposit, webhook
- Chat → Responsible for: booking threads, realtime, admin read access; customer-provider booking contact stays in the app
- Job execution → Responsible for: work days, materials, milestones, punch list, signature
- Balance, cash, cancellation, refunds → Responsible for: balance payment, cash records, cancellation engine, refunds
- Provider pay → Responsible for: pay calculation, payouts, ledger, earnings
- Reviews → Responsible for: ratings that feed matching, hide by admin
- Admin console → Responsible for: queues, config editor, audit log, reports
- Notifications → Responsible for: email and in-app alerts; paid SMS is deferred
- Legal and receipts → Responsible for: Terms, Privacy, policies, receipts, data requests

**Key Dependencies Between Files:**
Concept level map. Replace with real file paths once code exists.
- Matching score function → depends on → config table (weights), reviews (rating), bookings (past jobs), map distance function
- Offer chain timers → depends on → config table (windows, chain limit), offers table, server side timer
- Deposit and balance payments → depends on → PayMongo keys (server only), webhook handler, payments and bookings tables
- Webhook handler → updates → payments, bookings status, refunds
- Cancellation engine → depends on → booking status, payment tier, payments, refunds, provider reliability
- Arrival check → depends on → PostGIS point on the booking, GPS accuracy, admin override log
- Provider pay → depends on → work days, materials, milestones, rate, dispute flag
- Route guards and RLS → depend on → profiles role, every feature table
- Font size engine → depends on → design tokens (rem), user_settings table, every component
- Reviews → depend on → booking status completed and balance paid

**Booking status moves (owner approved 2026-10-18, Q37):**
- draft to open: customer. draft to cancelled: customer, admin
- open to offered: customer, admin, system. open to cancelled: customer, admin
- offered to accepted: provider, admin. offered to open: provider, admin, system. offered to cancelled: customer, admin
- accepted to quoted: provider, admin. accepted to cancelled: provider, admin (not the customer)
- quoted to deposit_paid: admin, system. quoted to cancelled: customer, provider, admin
- deposit_paid to scheduled: provider, admin, system. deposit_paid to cancelled: provider, admin
- scheduled to on_the_way: provider. scheduled to cancelled: provider, admin
- on_the_way to in_progress: provider, admin, system. on_the_way to cancelled: admin only, and only before site inspection; admin contacts the provider (Q44)
- in_progress to done: provider, admin. in_progress to cancelled: admin only
- done to signed: customer, admin. signed to balance_paid: admin, system. balance_paid to completed: admin, system

The assigned provider or an admin records the inspection using `mark_booking_site_inspected`. A database guard blocks the admin's on-the-way cancellation after that timestamp is set. The admin no-show flow must contact the provider; implement it in the cancellation/admin workflow.

Provider mobile numbers are private profile data. Do not expose them on customer-facing profiles; customer-provider contact for a booking happens through its in-app chat. The number may be used privately for OTP and system alerts.

**Notification event inventory (Phase 3.1):**
Recipients below are the people who need to act or know about a change. Urgent offers use email and in-app alerts per Q48, with no 15-minute delivery guarantee. Authentication emails are sent by Supabase Auth, not the app notification dispatcher.

The shared server-side dispatcher is `src/lib/notifications/delivery.ts`, with the common HTML and plain-text email layout in `src/lib/notifications/email-template.ts`. It writes in-app notifications through the service-role client and sends email through Brevo's transactional API. Provider approval email uses the same Brevo sender and a Supabase-generated one-time password setup link. Supabase Auth confirmation and recovery emails use Brevo SMTP after custom SMTP is configured in the Supabase dashboard. Q48 selects email plus in-app for urgent offers while paid SMS is deferred; the owner accepts that email may not arrive within 15 minutes. Phase 3.6 delivery records and independent retries live in `src/lib/notifications/delivery.ts` and `retry.ts`, backed by `notification_deliveries` and the atomic claim function in migration `20261018130000_notification_delivery_retry.sql`. The protected worker is `src/app/api/notifications/worker/route.ts`; `npm run notify:retry` calls it in development. Q49 sets three total attempts with five-minute retry intervals and one in-app alert per admin after a final failure. The retry timing unit checks and live final-failure/duplicate-alert check passed on 2026-10-19. Per Q50, `src/lib/notifications/preferences.ts` reads `user_settings.notification_prefs.email_enabled` before queuing email; a missing setting means enabled and in-app remains enabled. Email requires `BREVO_API_KEY`, `NOTIFICATION_FROM_EMAIL`, and `NOTIFICATION_REPLY_TO_EMAIL`; the worker also requires a private `NOTIFICATION_WORKER_SECRET`.

Phase 3.4 adds `src/components/notifications/notification-bell.tsx` and `notification-center.tsx`, plus role routes at `/customer/notifications`, `/provider/notifications`, and `/admin/notifications`. The bell reads only the current user's unread count; the list reads the latest 50 rows and marks individual rows read through the existing authenticated RLS policy. Q41 approves the bell between role navigation and the text-size control. On 2026-10-19, customer UI behavior passed and `npm run notify:access:test` verified guest denial, own-row read/mark-as-read, and cross-user denial for admin, customer, and provider. The email plus in-app test event also passed; Gmail received the test email in under a minute.

**Phase 4 location:** `src/components/location/location-picker.tsx` lazy-loads the Leaflet map in the browser and provides debounced Geoapify address search, a movable pin, device location and a landmark field. The server validates selected points with Geoapify reverse geocoding before saving longitude-first PostGIS geography or calling the nearby provider search. `20261019140000_location_and_arrival.sql` contains distance sorting, the 200 m arrival calculation, and reason-required admin override requests. Geoapify Free plan and attribution terms were reviewed on 2026-10-19; Geoapify and OpenStreetMap attribution must stay visible. The migration, API key configuration, live database checks, and 199 m/201 m arrival checks passed on 2026-10-19. The owner confirmed the HTTPS/current-location check on a real HONOR 400 also passed on 2026-10-19. Phase 4 was signed off and committed as `54cd4cc` on 2026-10-19.

**Phase 5 launch scope:** The client confirmed Metro Manila / NCR as the initial region (16 cities and Pateros; PSA PSGC current at 2025-07-31). The exact service catalog remains pending client feedback. The `services` catalog is stored in the admin-managed `public.services` table. Provider applications use an explicit NCR service-area list and reverse-geocode the applicant base pin. Customer booking coverage still needs a server-side NCR rule because provider matching currently uses a 15 km radius. Provider applicants submit through a restricted dashboard; an admin reviews the application and alone can view ID/selfie documents; approval activates the same account and uses its submitted information to create the provider profile. Pending or rejected applicants cannot access provider work features; the admin sends the outcome. Approved-provider files stay while they work and an admin deletes them on exit; rejected-applicant files are deleted after 30 days (Q20).

Q20 access migration `20261019150000_admin_only_provider_document_read.sql` changes both `provider_documents` row reads and `ids`/`selfies` storage reads to admin-only. Providers retain permission to upload their own documents. Apply this migration to the linked Supabase project before relying on the new access rule there.

**Phase 5 onboarding implementation (in progress):** `/apply/provider` creates a normal customer-role auth account and sends email confirmation to `/provider-application/submit`. Applicants submit profile details, service selection, location, rates, emergency contact details, and ID/selfie. NBI clearance is requested only when the admin enables the requirement in `/admin/config`. Payout method and account details are collected in provider settings only after approval, before the first payout. Pending/rejected accounts are redirected away from customer/provider work areas; RLS also blocks their booking and provider-service writes. `/admin/provider-applications` provides admin-only review, private signed document links, decisions, audit entries, and in-app/email notices. Approval promotes the same account to provider. Rejection schedules submitted documents for deletion after 30 days; `POST /api/provider-applications/cleanup` performs deletion when called with `PROVIDER_DOCUMENT_CLEANUP_SECRET`. Migrations `20261019150000` through `20261019180000` are applied; a daily scheduler must still call the cleanup endpoint. This work is not signed off yet.

**Phase 6 service catalog (in progress):** `/admin/services` lets administrators add and edit catalog entries using the existing `services` table. Each service stores category, name, default minor/major class, urgent eligibility, active status, and display order. Inactive services remain available to historical records and cannot be selected for new bookings. Service changes are audited. The client supplied the launch service names on 2026-10-19: Leak Detection & Repair; Pipe Installation & Repiping; Drain & Sewer Cleaning; Wiring & Rewiring; Lighting & Outlets; Emergency Service; Painting; Waterproofing; House & Condominium Renovation; Modular Cabinets; Roof & Gutter Installation; Carpentry Works; Customized Cabinets. Initial classifications are minor by default except House & Condominium Renovation (major), with only Emergency Service urgent-eligible. Migration `20261019190000_launch_services.sql` adds this catalog and deactivates the temporary sample entries; it was applied to the linked Supabase project on 2026-10-19. The admin catalog UI and API are implemented but not yet tested; the owner directed Phase 6 work to proceed before Phase 5 sign-off.

| Event | Recipient(s) | Notes |
|---|---|---|
| Signup email confirmation or password reset | Account owner | Supabase Auth email flow; Phase 2.16 live recovery check is still pending |
| Provider documents submitted for review | Admin | Add to the provider review queue. Only admins can view the documents |
| Provider approved, rejected or suspended | Provider | The admin communicates the result; providers cannot view their ID/selfie documents |
| Customer submits a booking request / a provider receives an offer | Selected provider; admin when the request needs intervention | Email plus in-app per Q48; no 15-minute delivery guarantee |
| Provider accepts or declines an offer | Customer | If the offer chain reaches its miss limit, also alert admin |
| No provider found or offer chain reaches its miss limit | Customer and admin | Admin receives the action item; customer receives the outcome |
| Quote submitted or admin decision recorded | Customer and provider | Customer must know when to review the quote; provider needs the final decision |
| Deposit payment succeeds or fails | Customer and admin | Provider is informed when the booking is cleared to schedule |
| Schedule confirmed, changed or approaching | Customer and provider | Includes schedule reminders |
| Provider marks the job on the way | Customer | Do not expose the provider's private phone number |
| Daily work update, milestone submitted or work marked done | Customer; admin when approval/action is required | Keep job progress visible to the customer |
| Customer signs completion or balance payment is recorded | Customer, provider and admin | Each party needs the resulting job/payment status |
| Cancellation or cancellation request is recorded | Other booking party and admin | For admin cancellation after on-the-way, admin contacts the provider (Q44) |
| New booking chat message | Other booking party | Admin can read all threads; that alone does not create a notification to admin |
| Completed, paid booking becomes eligible for review | Customer | One review per booking, per the plan |
| Provider payout succeeds or fails | Provider and admin | Failed payout creates an admin follow-up item |
| Notification repeatedly fails or a critical webhook fails | Admin | Retry first; alert admin after repeated failure as specified in Phases 3 and 18 |

**What Must Never Be Touched Without Human Approval:**
- Auth logic and route guards
- RLS policies and database schema (migrations)
- Payment, refund and webhook code
- Cancellation engine and fee rules
- Payout and cash record logic
- Config table values (weights, windows, fees, thresholds)
- Locked Decisions table in phases-plan.md
- Anything holding keys or secrets

**Known Fragile Areas:**
None yet. Watch for these from the start:
- PostGIS point order: longitude first, then latitude
- PostGIS lives in the extensions schema (supabase/migrations/20261017120000_enable_postgis.sql). Write its types and functions with the extensions. prefix, for example extensions.geography
- Webhook repeats: handlers must be safe to run twice
- Offer timers must run on the server, not in the browser
- RLS gaps that let one role read another role's data
- Leaflet must load in the browser only, not during server rendering
- Browser roles have no table access by default. A new table with no grant returns an empty list, not an error
- Booking status can only change through change_booking_status. Direct updates, even with the service role, are blocked
- Role changes reach the sign in token only after a refresh (up to 1 hour)
- The proxy file name is Next.js 16 naming (older versions call it middleware). Read node_modules/next/dist/docs before changing it
- Public OpenStreetMap tile servers are for light use. A production tile plan is needed (Q14, Phase 17)

---
## STRUCTURE CHANGE LOG
---
AI: when the structure changes during the build, log it here.

| Date | Change | Reason |
|------|--------|--------|
| 2026-10-16 | File created from template. Scale set to Medium, stack and map recorded. No code exists yet | Phase 0 step 0.6 |
| 2026-10-17 | Added route groups (public), (customer), (provider), (admin) under src/app, each with its own layout. Role paths are /customer, /provider, /admin. Added src/components/layout (app-shell, public-shell, role-nav, more-list, nav-config) and ui/placeholder-screen, ui/settings-screen. Added tokens --tab-bar-height and --icon-size. Moved the old src/app/page.tsx into (public). Placeholder pages use [section] and [slug] routes that later phases replace with real folders | Phase 1 step 1.20 |
| 2026-10-17 | Added scripts/check-tokens.mjs and the npm script check:tokens. Scans src/components and src/app. Allowed raw values: media query widths 40rem and 48rem only. Every file is scanned, including src/app/globals.css (its raw values moved into tokens.css as --size-viewport-width, --size-sr-only and --duration-reduced-motion). Owner confirmed Q36 on 2026-10-17, see decision-log.md #11 | Phase 1 step 1.22 |
| 2026-10-17 | Phase 2 files added: ten SQL migrations, src/proxy.ts, src/lib/auth, src/lib/supabase, auth pages under (public), src/app/auth/confirm, two scripts, two test files. Role and ROLES moved from nav-config.ts to src/lib/auth/roles.ts (nav-config re-exports them, so imports do not change). Removed the login placeholder from (public)/[slug] because a real login page now exists. See decision-log.md #13 | Phase 2 |
| 2026-10-18 | Added `src/lib/notifications/send.ts` as a server-only dispatcher for in-app alerts and Resend email, plus per-user email preference handling | Phase 3 steps 3.2 and 3.7 |
| 2026-10-18 | Added a shared HTML and plain-text notification email template; documented the sender and reply-to environment settings | Phase 3 step 3.3 |
| 2026-10-18 | Added in-app notification list routes for all roles, mark-as-read behavior, and an unread count bell in the shared header, per owner approval Q41 | Phase 3 step 3.4 |
| 2026-10-19 | Moved signed-in role navigation to a vertical desktop sidebar and added matching vertical guest links; phone role navigation remains the bottom tab bar | Owner request; uses the Phase 1.20 desktop sidebar option |
| 2026-10-18 | Recorded Q48: urgent provider offers use email plus in-app alerts while paid SMS is deferred; no 15-minute delivery guarantee | Phase 3 step 3.5 |
| 2026-10-18 | Added private notification delivery records, atomic retry claims, the protected worker route, and the manual retry command per Q49 | Phase 3 step 3.6 |
| 2026-10-18 | Recorded Q50 and made the server dispatcher respect each user's email preference stored in `user_settings.notification_prefs` | Phase 3 step 3.7 |
| 2026-10-19 | Added customer account creation followed by a signed-in setup step for the service address and consent records. The customer onboarding RPC validates the customer role and stores the profile, home address text, and versioned consent records; the existing location API validates and saves the map pin. The associated migration is local and still needs to be applied and checked | Phase 5 customer onboarding |
| 2026-10-25 | Guest redesign: `public-shell` rewritten with top navigation and footer, own stylesheet; new `src/components/public` (brand mark, service icons), `src/components/auth` (AuthSplit, Turnstile widget, Google button), `src/lib/public` (business info, launch services, cached service loader), `src/lib/auth/turnstile.ts` and `session-policy.ts`; new routes `/api/auth/signup` and `/auth/continue`; login route verifies Turnstile and supports Remember me; new migration `20261025100000_service_descriptions.sql`; admin service catalog edits the description. See decision-log.md #28 | Phase 5 and guest pages |
| 2026-10-25 | Phase 6 files: `src/lib/booking/rules.ts` (pure rules shared by the form and tests), customer routes `bookings`, `bookings/new` (stepper, autosave, photos, new address), `bookings/[id]` (detail, delete draft), customer home with a Book a service link, `ui/textarea`, migration `20261025120000_booking_request.sql` (private `booking-photos` bucket and `submit_booking`). Provider application takes account details from the form when a Google account has none. See decision-log.md #29 | Phase 6 |
| 2026-10-26 | Phase 7 matching: ranking in `src/lib/matching` (weights in `config`), offer rules in SQL functions, notices returned as jsonb and sent by server routes, expired offers handled on page load and by `/api/jobs/expire-offers` | decision-log #30 |
| 2026-10-27 | Phase 9 quotes: pure rules in `src/lib/quotes` (tier, deposit, milestones), config loader and expiry in `src/lib/quotes`, routes `/api/bookings/[id]/inspection`, `/api/bookings/[id]/quote`, `/api/quotes/[id]/decide`, `/api/quotes/[id]/respond`, UI in `src/components/quotes`, provider `jobs` screens, admin quote queue on Needs action, quote card on the customer booking page, migration `20261026150000_quotes_and_deposit_rules.sql` (new `site_inspections` table, quote columns, customer cannot read unapproved quotes) | decision-log #33 |
