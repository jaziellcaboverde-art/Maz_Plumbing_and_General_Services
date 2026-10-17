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

**Project Name:** Capstone

**Project Type:**
Responsive web app, mobile first, with three roles (customer, provider, admin). Home services booking platform for the Philippines.

**Tech Stack:**
- Frontend: Next.js 16.4.2 (App Router) with React 19.3.0 and TypeScript 5. Plain CSS modules and design tokens, no Tailwind (decision-log.md #8). Versions as in package.json on 2026-10-17
- Backend: Next.js server actions and route handlers, plus Supabase for data logic (SQL functions, RLS, realtime)
- Database: Supabase Postgres with PostGIS. All schema as SQL migration files in the repo
- Auth: Supabase Auth, email and password with verification. Mobile OTP blocked until the SMS question (Q19) is answered
- Other:
  - Email: Resend
  - SMS: Twilio, through the phone provider built into Supabase Auth for OTP, and the same account for fast alerts (Q19, decision-log.md #12)
  - Payments: PayMongo (test mode until Phase 17)
  - Map: Leaflet and react-leaflet with OpenStreetMap data. Tile provider and geocoder pending (Q14)
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
- src/lib (font size engine, class name helper)
- supabase/migrations (empty until Phase 2)
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
- Chat → Responsible for: booking threads, realtime, admin read access
- Job execution → Responsible for: work days, materials, milestones, punch list, signature
- Balance, cash, cancellation, refunds → Responsible for: balance payment, cash records, cancellation engine, refunds
- Provider pay → Responsible for: pay calculation, payouts, ledger, earnings
- Reviews → Responsible for: ratings that feed matching, hide by admin
- Admin console → Responsible for: queues, config editor, audit log, reports
- Notifications → Responsible for: email, in app, fast alerts
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
