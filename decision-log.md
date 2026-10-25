# decision-log.md

---
## AI RULES — READ FULLY BEFORE ANY ACTION
---

1. Read all existing entries before suggesting anything already decided.
2. Never re-debate a logged decision. If it needs revisiting → flag it,
   don't silently override it.
3. At every major milestone → add an entry before continuing.
4. Before logging anything, apply this filter — if ALL three are false, skip it:
   - Hard to reverse?
   - Affects other parts of the system?
   - Confusing without an explanation?
5. Before presenting options at a milestone → search current community
   consensus on each direction. Present findings, then wait for human
   decision before logging.
6. If two directions were discussed with the human → both get logged,
   with the reason the chosen path was taken.

---
## DECISION ENTRIES
---

Searches for entries 1 to 6 were run on 2026-10-16. Findings are summarized in plain words, not quoted. Several sources are vendor or gig pages, so treat them as signals, not proof. Nothing here is legal or tax advice.

### #1 — Tech stack
**Date:** 2026-10-16
**Milestone:** Phase 0 — project start

**Context:**
A three role marketplace needs auth, roles, location queries, file storage, realtime chat and payments, built by a small team.

**Options Considered:**
- Option A: Next.js with Supabase (Postgres, PostGIS, Auth, Storage, Realtime), Resend, PayMongo
- Option B: Separate custom backend with its own database and auth

**Community Consensus:**
Next.js with Supabase is a widely documented pairing. Guides show PostGIS enabled from the Supabase dashboard, radius searches written as SQL functions, and the map loaded as a browser only component. Marketplace reviews on freelance sites treat row level security as the area that needs the most checking. Some projects pair Supabase with a separate API layer, which is more moving parts than this scale needs.

**Decision:**
Option A. Fewer services to run, PostGIS and realtime come built in, and it fits Medium scale.

**Consequences:**
RLS must be written and tested for every table (Phase 2.9 and 2.16). Business rules that must not be bypassed (payments, offers) run on the server. Moving off Supabase later would be costly.

### #2 — Map: Leaflet with OpenStreetMap
**Date:** 2026-10-16
**Milestone:** Phase 0 — project start

**Context:**
The app needs a draggable pin, address search, distance sorting and an arrival check, with low running cost.

**Options Considered:**
- Option A: Leaflet with OpenStreetMap data
- Option B: Google Maps

**Community Consensus:**
Leaflet is free and works with any tile provider, so cost depends on the tile provider, not Leaflet. It suits custom looks and predictable cost. Google Maps bundles places search and street view in one vendor but bills by usage and does not allow its tiles to be used outside its own API. The public OpenStreetMap tile server discourages heavy production traffic, so a real app needs a hosted tile plan.

**Decision:**
Option A. Keep the OpenStreetMap attribution visible. Choose the production tile provider and geocoder in Phase 4 (Q14).

**Consequences:**
Address search quality in the Philippines must be tested. The landmark text field is the fallback. A usage plan is needed before launch (Phase 17.5).

### #3 — Primary button color: navy with white text
**Date:** 2026-10-16
**Milestone:** Phase 0 — project start

**Context:**
The look is all white with black text, so the primary button color sets the whole feel.

**Options Considered:**
- Option A: Navy primary, darker navy on hover. Secondary is white with black text and border
- Option B: A brighter brand blue for actions

**Community Consensus:**
Design systems commonly use one prominent brand color for the single main action per screen and a quieter style for the others. Accessibility guidance asks for 4.5 to 1 contrast for text and 3 to 1 for button boundaries and icons. Dark navy with white text passes this easily. Institutional design systems use navy as a primary color for this reason.

**Decision:**
Option A, as in Locked Decisions. One primary button per screen or group. On phones the primary sits above the secondary.

**Consequences:**
Exact navy value is set once as a token in Phase 1.9, and contrast is checked at every font size (Phase 16.5).

### #4 — Payment tiers and deposit
**Date:** 2026-10-16
**Milestone:** Phase 0 — project start

**Context:**
Jobs range from small repairs to renovations. Money must be protected for both sides.

**Options Considered:**
- Option A: Three tiers by quote size. 50 percent deposit for all. Large jobs add milestones and a 10 percent holdback until the punch list is confirmed
- Option B: Single split for every job

**Community Consensus:**
Staged payments for larger jobs (deposit, midpoint, completion) are common in home services, and platforms often tie milestones to checkable work. A consumer protection agency advises traceable payments for deposits, not cash or person to person apps, and no final payment until the work satisfies the customer. That supports the holdback. Guidance for tradespeople often puts deposits lower, around 20 to 25 percent for materials heavy jobs, so 50 percent is on the high side.

**Decision:**
Option A as in Locked Decisions. The 50 percent deposit is kept for now. Open question 26 asks the owner to confirm it or lower it for Minor jobs.

**Consequences:**
Tier is chosen from the quote value and the major flag (Phase 7.5). Thresholds live in config so they can change after launch (Phase 18.2). A high deposit may lower conversion.

### #5 — Signature: on screen at Done
**Date:** 2026-10-16
**Milestone:** Phase 0 — project start

**Context:**
A signed record is needed that the customer accepted the finished work and the materials receipts.

**Options Considered:**
- Option A: Signature drawn on screen, saved with time, location and signer. Admin override with a reason
- Option B: Paper signature photographed or uploaded

**Community Consensus:**
Under the Electronic Commerce Act (RA 8792), an electronic signature counts like a written one when it can be shown that a set procedure, not changeable by the parties, was followed. Sources say drawn on screen signatures are accepted and that timestamps and audit trails strengthen them. Digital certificate signatures are mainly for stronger proof in court.

**Decision:**
Option A. Save the image, time, location, signer and device, and log every override.

**Consequences:**
The signature record must not be editable after saving. The lawyer review (Q12) should confirm this is enough. Admin overrides need a visible reason.

### #6 — Cancellation fees
**Date:** 2026-10-16
**Milestone:** Phase 0 — project start

**Context:**
Providers lose time when customers cancel. Customers need fair, predictable fees.

**Options Considered:**
- Option A: Minor jobs flat P1,500 from the deposit. Major jobs real costs so far, capped at the deposit. Provider cancels means no fee and a reliability drop
- Option B: A single percentage for all jobs

**Community Consensus:**
Taking the cancellation fee out of the deposit and returning or crediting the rest is a common setup in booking tools. Fees by timing (early, late, after work started) are also common. Consumer guidance elsewhere allows keeping part of a deposit to cover real losses, but warns that unfair charges can be challenged. When a provider cancels, a full refund is the norm.

**Decision:**
Option A as in Locked Decisions. Major fees need a cost breakdown the customer can see (Phase 10.8).

**Consequences:**
The cancellation policy text needs lawyer review for Philippine rules (Q12). Q21 decides whether the deposit is held or refunded when no provider is found. Fees live in config.

**Owner correction (2026-10-18):** The client's P1,500 charge is for an ocular inspection, not a minor cancellation fee. The earlier flat P1,500 minor cancellation-fee decision is superseded. The minor cancellation fee is unresolved; the major-job rule remains documented costs capped at the deposit.

**Owner clarification (2026-10-18):** The P1,500 ocular inspection fee is charged separately and is not credited toward the job price. See open-questions.md Q45.

### #7 — Customer picks the provider, admin assigns foremen on large jobs
**Date:** 2026-10-17
**Milestone:** Phase 1 design review, before Phase 6 and 7 are built

**Context:**
The first plan had the system pick the best provider and offer the job down a chain. The owner wants the customer to choose, with the system recommending. Large projects need a lead (foreman) assigned by admin or the system.

**Options Considered:**
- Option A: System picks and offers down a chain (the original plan)
- Option B: System recommends a ranked list, customer picks, picked provider accepts or declines. Admin assigns a foreman on large jobs

**Community Consensus:**
Searched 2026-10-17. Handy style platforms mostly let the customer browse and pick, with the system suggesting good fits from location, availability and ratings. Suggestion based matching cuts customer effort but depends on good rating and availability data. Standard jobs suit instant booking, while unusual or complex jobs suit quotes. One booking tool lets the chosen provider accept or decline, and if they do not answer, the request goes to other matching providers unless the client opts out. Sources are vendor blogs, so treat them as signals, not proof.

**Decision:**
Option B. Normal jobs: customer picks from a ranked list and the picked provider must accept. If declined, the customer picks again, with an optional auto offer to the next best. Urgent jobs keep the automatic chain (Q31). Large jobs: admin assigns a foreman, the customer can ask for a change, admin decides (Q32, Q33). Foreman only at launch, no crew (Q34). Items marked Q31 to Q35 are working defaults and need owner confirmation.

**Consequences:**
- Phase 7 is rewritten. The scoring stays and now ranks the list.
- New booking status: open (submitted, waiting for a pick or an assignment).
- Customers wait on a provider response, so conversion can drop if providers are slow. Track the pick and decline rates after launch.
- Reliability and rating now matter more, because they decide who appears first.
- Crew support (several workers per job) changes check in, pay and chat rules. It is deferred to after launch.


### #8 — Design plan approved: tokens as CSS variables, Atkinson Hyperlegible Next, no Tailwind
**Date:** 2026-10-17
**Milestone:** Phase 1 — design plan approval (step 1.15)

**Context:**
Step 1.15 needed the owner to approve the design plan (next step sentence on every screen, 6 value palette, one type family, 6 wireframes) before tokens and components.

**Options Considered:**
- Option A: Design tokens as plain CSS variables in one file (src/styles/tokens.css), no Tailwind
- Option B: Tailwind with a custom theme

**Community Consensus:**
Not searched for this entry. The choice follows design plan.md, which picked Option A so a check script (step 1.22) can flag raw colors, sizes and radii in components. Treat this as the plan author's reasoning, not outside evidence.

**Decision:**
Owner approved the design plan on 2026-10-17 ("do what you recommend"). Option A. Font: Atkinson Hyperlegible Next through next/font/google, weights 400 and 600 only (confirmed available in this Next version's font list). Public Sans is the fallback.

**Consequences:**
- Every component reads var(--token). Raw values live only in tokens.css.
- No dark mode: the look is locked to all white, so color-scheme is light.
- Palette hex values are final. Contrast is tested in tests/tokens.test.ts and passes (step 1.17).
- Switching to Tailwind later would mean rewriting every component style.


### #9 — Font size is applied by an inline script and a cookie, not read on the server
**Date:** 2026-10-17
**Milestone:** Phase 1 — font size engine (step 1.19)

**Context:**
The text size setting (4 levels) must apply to every page with no flash. next.config.ts has cacheComponents on. The obvious route, reading the level with cookies() in the root layout, would stop every route from being prerendered (Next docs for cookies, with Cache Components).

**Options Considered:**
- Option A: Read the cookie in the root layout with cookies() and set data-font-size on the html tag on the server
- Option B: A small inline script in head reads the cookie and sets data-font-size before the first paint (the pattern in the Next guide "How to prevent flash before hydration")

**Community Consensus:**
Taken from the Next.js docs installed in node_modules (cookies and preventing flash before hydration). No outside search was run.

**Decision:**
Option B. The server always renders medium. The script applies the saved level, and the html tag has suppressHydrationWarning for that one attribute. The level is saved in the capstone-font-size cookie for now. Phase 5 also saves it to user_settings.

**Consequences:**
- Pages stay prerenderable. No server work per request.
- The server does not know the level, so server rendered output cannot depend on it. Layout must reflow with rem only.
- Do not add other attributes to the html tag that differ between server and client without thinking about hydration.
- When user_settings exists, the saved value must win over the cookie after login (decide in Phase 5).


### #10 — Base components use native browser elements and a plain anchor for list links
**Date:** 2026-10-17
**Milestone:** Phase 1 — base components (step 1.21)

**Context:**
Step 1.21 needs 12 components with all states, tokens only, keyboard friendly, readable at four text sizes, on phones and desktop.

**Options Considered:**
- Option A: Native elements (select, dialog, input type file, radio, checkbox) styled with tokens
- Option B: A component library such as Radix or shadcn/ui, or custom built dropdowns and modals

**Community Consensus:**
Not searched. The choice follows the constraints already in the plan: no Tailwind, tokens only, Lucide only, and few dependencies. Native elements give phone pickers, focus handling and screen reader support without extra packages.

**Decision:**
Option A. Select uses the native select. Modal uses the dialog element. File upload uses the native file input with a dashed drop area on top. List rows that link use a plain anchor for now. Switch them to next/link when the shells exist (1.20).

**Consequences:**
- No new dependencies were added.
- jsdom has no dialog methods, so tests/setup.ts adds small stand-ins for tests only.
- A native select cannot be styled inside its open list. That is accepted.
- The media query width 40rem is the one raw value allowed outside tokens.css. Step 1.22 must allow it.
- Step 1.20 must wrap the app in ToastProvider and set --toast-offset-bottom for screens with a bottom tab bar.


### #11 — Token check allows two media query widths and scans every file
**Date:** 2026-10-17
**Milestone:** Phase 1 — token check (step 1.22), open question Q36

**Context:**
Decision #10 said the media query width 40rem is the one raw value allowed outside tokens.css. The layout shells from step 1.20 also use 48rem, and src/app/globals.css held raw values (100vw, 1px for screen reader text, 0.01ms for reduced motion). The check script needed a rule for both.

**Options Considered:**
- Option A: Allow media query widths 40rem and 48rem only. Scan every file, including globals.css, and move its raw values into tokens.css
- Option B: Allow the two widths and skip globals.css as a base file
- Option C: Allow any raw value inside a media query

**Community Consensus:**
Not searched. Media queries cannot read custom properties, which is why the widths cannot be tokens. The rest follows the Phase 1 rule that raw values live only in tokens.css.

**Decision:**
Option A. The owner said "do what you recommend" on 2026-10-17. The script has one list of allowed widths (ALLOWED_BREAKPOINTS) and no skipped files.

**Consequences:**
- A new breakpoint needs a new entry in ALLOWED_BREAKPOINTS in scripts/check-tokens.mjs, and the owner's approval.
- globals.css now uses three new tokens: --size-viewport-width, --size-sr-only, --duration-reduced-motion.
- Raw durations are not checked by the script. The reduced motion value is a token for consistency only.


### #12 — SMS provider: Twilio through Supabase Auth
**Date:** 2026-10-17
**Milestone:** Phase 2 — mobile number OTP (step 2.17), open question Q19

**Context:**
Mobile number OTP at sign up and urgent offer alerts (15 minute window, Phase 3) need SMS to Philippine numbers. Email alone is too slow for the offer window.

**Options Considered:**
- Option A: Twilio, using the phone provider built into Supabase Auth for OTP, and the same account for fast alerts
- Option B: A local Philippine SMS provider (for example Semaphore or PhilSMS) connected to Supabase through the Send SMS auth hook, which needs custom code and a hook secret
- Option C: Vonage, also built into Supabase Auth

**Community Consensus:**
Searched on 2026-10-17. Supabase Auth has built in phone providers for Twilio, Twilio Verify, MessageBird, Vonage and TextLocal, and a Send SMS hook for any other provider. Several guides say Philippine alphanumeric sender IDs must be registered with the networks (Globe, Smart, DITO) through the SMS provider, that this takes about 2 to 4 weeks, and that it needs business registration documents such as SEC or DTI and BIR papers. Unregistered traffic may be filtered or overwritten, and Globe blocks links. Local providers are described as cheaper, but those figures come from vendor and gig pages and were not checked. The Twilio and Vonage Philippine rules read the same. Treat all of this as a starting point and check current prices and rules before launch.

**Decision:**
Option A. The owner said "do what you think is right" on 2026-10-17. Twilio is built in, so there is no custom hook to build or secure for OTP, and one vendor covers OTP and fast alerts. The choice between the plain Twilio provider and Twilio Verify is made when step 2.17 is built.

**Consequences:**
- Reversible while nothing is built. Switching later means changing the send function (Phase 3) and the Supabase Auth phone setting.
- The notification send function (step 3.2) must keep one interface so a local provider can replace Twilio if cost matters after launch.
- The owner should start the sender ID registration early. It needs business registration documents the owner holds, so it cannot be done by the build.
- Test OTP in development with the owner's own number. Check Twilio trial limits when step 2.17 starts.
- Costs are paid to Twilio directly for every message sent.

### #13 — Roles live in profiles, are mirrored into the sign in token, and booking status changes through one function
**Date:** 2026-10-17
**Milestone:** Phase 2 — database, auth and roles (steps 2.9, 2.10, 2.13, 2.18)

**Context:**
Route guards need the role on every request without a database call. Row level security needs a role it can trust. Booking status must never be changed by loose code (phases-plan.md step 2.10).

**Options Considered:**
- Option A: Role stored in profiles (source of truth). A database trigger copies it into the user's app_metadata, which is inside the signed token. The proxy reads it with getClaims. All status changes go through change_booking_status, enforced by a trigger. Browser roles start with no table access and get explicit grants, including column level grants
- Option B: Role only in the token (app_metadata). RLS reads the token
- Option C: Role in profiles only. The proxy asks the database on every request

**Community Consensus:**
Not searched. The pattern follows Supabase's documented guidance that user_metadata can be edited by the user while app_metadata cannot, and that getClaims verifies the token signature on the server. This was written from memory without internet access. Check it against the current Supabase docs before launch.

**Decision:**
Option A. The proposal is not final until the owner confirms Q37 (status moves) and Q39 (API keys).

**Consequences:**
- A role change reaches a signed in person on the next token refresh (up to 1 hour) or the next sign in.
- Nothing in the browser can change a role, a booking status, a price, a provider or the miss counter. That code runs on the server with the service role, or in database functions, and each such use must write an audit row.
- Every new table starts with no browser access. Each later migration must grant exactly what its phase needs, or the feature will show an empty list.
- Even the service role cannot change a booking status directly or edit audit rows.
- The proxy sends everyone to /login for role pages while Supabase keys are empty. The Phase 1 placeholder pages under /customer, /provider and /admin are not reachable until Supabase is set up.
- Moving off Supabase Auth later would mean rewriting the proxy, the trigger and the policies.

### #14 — Hosted map tiles and geocoding: Geoapify
**Date:** 2026-10-18
**Milestone:** Phase 4 — map and location (step 4.1), open question Q14

**Context:**
MAZ Plumbing and General Services needs hosted map tiles for Leaflet and an address geocoder for production use in a commercial home-services app. The public OpenStreetMap tile service is not the production tile host.

**Options Considered:**
- Option A: Geoapify for both map tiles and geocoding
- Option B: MapTiler for both
- Option C: Stadia Maps for both

**Community Consensus:**
Checked provider pricing and terms on 2026-10-18. Geoapify's official pricing page permits commercial production use on its Free plan with required attribution: 3,000 shared credits per day, up to 5 requests per second, and no credit card. The quota is soft; sustained overuse can lead to an upgrade request or account restriction. MapTiler's Free plan is for personal or non-commercial use. Stadia Maps' Free plan also excludes commercial use. These terms make Geoapify the only one of these three that fits the current no-cost commercial launch requirement. Sources: [Geoapify pricing](https://www.geoapify.com/pricing/), [Geoapify pricing details](https://www.geoapify.com/pricing-details/), [MapTiler Cloud pricing](https://www.maptiler.com/cloud/pricing/), [Stadia Maps pricing](https://stadiamaps.com/pricing).

**Decision:**
Option A, selected by the owner on 2026-10-18 for both hosted map tiles and address geocoding.

**Consequences:**
- Show the required Geoapify and data-source attribution on maps and near geocoding results.
- Map tiles and geocoding share the 3,000-credit daily Free allowance. A map tile costs 0.25 credits and a standard geocoding request costs 1 credit; usage must be monitored as traffic grows.
- The Free plan allows up to 5 requests per second. Its soft quota does not guarantee an immediate stop at the limit, so usage alerts and a paid-plan decision are needed before production volume grows.
- This records the provider choice only. Phase 4 remains gated until Phases 2 and 3 pass.

### #15 — Booking status approval and pre-inspection cancellation
**Date:** 2026-10-18
**Milestone:** Phase 2, steps 2.9–2.10 (Q37 and Q44)

**Decision:**
The owner approved the proposed booking status flow. If a provider is on the way, only an admin may cancel, and only before the provider has inspected the site. This exception covers a customer who ghosts, does not meet the provider, or refuses access. The admin contacts the provider.

**Consequences:**
- The database records when the site inspection happens and rejects this cancellation after that timestamp.
- The admin cancellation workflow must contact the provider. Implement that operational flow with cancellation handling and notifications.

### #16 — Keep customer-provider contact in the system
**Date:** 2026-10-18
**Milestone:** Phase 5 provider profiles and Phase 8 chat (Q46)

**Decision:**
Do not show provider phone numbers on customer-facing profiles. Customers contact providers through the in-app chat attached to the booking. Keep provider numbers private for OTP and system alerts.

**Consequences:**
- The app stores the conversation with the booking, and admins can review it when needed.
- Provider profile screens must not reveal mobile numbers.

### #17 — Email authentication for development; defer paid SMS
**Date:** 2026-10-18
**Milestone:** Phase 2 authentication and Phase 3 notifications

**Decision:**
Use email sign-in and verification during development. The owner has no sending domain, so use Supabase's built-in email service for tests to project team addresses only. Defer phone OTP and paid SMS until a budget is available. This supersedes the earlier Twilio selection for current development.

**Consequences:**
- Before customer email delivery, configure custom SMTP and verify a sender domain. Supabase's built-in sender is limited to project team addresses and currently 2 emails per hour. [Supabase custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp)
- Decide before Phase 3 whether email plus in-app alerts can meet the 15-minute urgent offer window or paid SMS should be budgeted.
- Email login is available now; it is not an SMS message and does not verify a phone number.

### #18 — Keep notification bell in the role header
**Date:** 2026-10-18
**Milestone:** Phase 3, step 3.4 (Q41)

**Decision:**
Keep an unread notification bell in the customer, provider and admin headers, between the role navigation and text-size control.

**Consequences:**
- Each role has a notifications page with the latest notifications and a mark-as-read action.
- The unread count and notification list use the existing per-user row-level security rules.

### #19 — Use email and in-app for urgent offer alerts
**Date:** 2026-10-18
**Milestone:** Phase 3, step 3.5 (Q48)

**Decision:**
While paid SMS is deferred, urgent provider offers use email plus in-app notifications. The owner accepts that email delivery may not arrive within the 15-minute offer window.

**Consequences:**
- Do not claim or rely on a 15-minute alert delivery guarantee.
- Measure and record actual email and in-app delivery during Phase 3.8 verification.
- Revisit paid SMS if urgent offers require a guaranteed fast alert.

### #20 — Retry failed notification delivery
**Date:** 2026-10-18
**Milestone:** Phase 3, step 3.6 (Q49)

**Decision:**
Attempt each selected delivery channel three times total: the initial attempt, then two retries five minutes apart. After the third failure, create one in-app alert for each admin.

**Consequences:**
- Email and in-app delivery are tracked independently.
- Retry delivery rows are private to server code and cannot be read by browser roles.
- The retry worker must run for delayed retries and admin alerts; it is manual in development and needs a deployment scheduler later (Q40).

### #21 — Notification channel preferences
**Date:** 2026-10-18
**Milestone:** Phase 3, step 3.7 (Q50)

**Decision:**
Email and in-app notifications are enabled by default. A user may turn off email notifications; in-app booking updates remain enabled.

**Consequences:**
- Store the email choice in `user_settings.notification_prefs.email_enabled`; a missing value means enabled.
- The server dispatcher checks the preference before queuing email. The user-facing settings control is built in Phase 5.

### #22 — Defer live email-confirmation verification to Phase 5
**Date:** 2026-10-19
**Milestone:** Phase 2, step 2.16 (verification performed with Phase 5 signup)

**Decision:**
The owner asked to verify signup email confirmation together with the Phase 5 signup screen. Keep the existing confirmation callback and password-reset flow as implemented; this defers only the live signup-confirmation check.

**Consequences:**
- Keep step 2.16 visibly deferred until Phase 5 signup can be tested end to end.
- Do not change login, password reset, or the email-confirmation callback because of this deferral.
- Phase 4 map work may proceed under this owner-approved phase exception.

### #23 — Start the launch in Luzon and keep services configurable (superseded)
**Date:** 2026-10-19
**Milestone:** Phase 5 — provider onboarding (Q22)

**Context:**
The owner initially wanted to begin in Luzon and adjust the coverage as client feedback came in. The client later narrowed this to Metro Manila; see decision #25.

**Decision:**
The Luzon-wide direction is superseded. Keep the service catalog and launch coverage changeable.

**Consequences:**
- Do not hardcode a permanent service list.
- The service catalog already lives in the admin-managed `services` table.
- Provider matching currently uses a 15 km distance limit, so the narrower launch still needs explicit coverage rules.

### #25 — Launch coverage is Metro Manila
**Date:** 2026-10-19
**Milestone:** Phase 5 — provider onboarding (Q22)

**Context:**
The client confirmed the service launches in Metro Manila.

**Decision:**
Use Metro Manila / National Capital Region as the launch area: its 16 cities and Pateros. Keep the actual service catalog changeable and pending client confirmation.

**Consequences:**
- Provider applications select NCR service areas, and the submitted base location is checked against NCR using reverse geocoding.
- Provider matching currently uses a 15 km radius, which does not itself ensure customer bookings remain inside NCR.
- The service catalog remains admin-managed and is not hardcoded to a guessed client list.

### #24 — Provider application dashboard and admin-only document access
**Date:** 2026-10-19
**Milestone:** Phase 5, provider onboarding (Q20)

**Decision (owner confirmed):**
Applicants submit provider requirements through a restricted application dashboard. The applicant can see status and admin messages but cannot access provider work features while pending or rejected. Only admins may view the ID/selfie documents. When approved, the system activates that same account as a provider and builds the provider profile from the submitted information, avoiding manual re-entry. The admin sends the applicant the decision/result.

**Still open:**
- Approved-provider documents remain while the provider works with MAZ; an admin deletes them when removing the account on resignation.
- Rejected-applicant documents are deleted after 30 days.

### #26 — Client-confirmed launch service list
**Date:** 2026-10-19
**Milestone:** Phase 6, step 6.1 (Q22)

**Context:**
The client confirmed Metro Manila / NCR as the launch area. The owner supplied the business's service-card image after the launch catalog had been left open for confirmation.

**Decision:**
Use the following 13 client-provided service names in the launch catalog: Leak Detection & Repair; Pipe Installation & Repiping; Drain & Sewer Cleaning; Wiring & Rewiring; Lighting & Outlets; Emergency Service; Painting; Waterproofing; House & Condominium Renovation; Modular Cabinets; Roof & Gutter Installation; Carpentry Works; Customized Cabinets.

**Consequences:**
- Keep the catalog admin-managed so services can be changed later.
- The current `services` table stores category, name, default class, urgent eligibility, active status, and display order; it has no description field. The image's descriptions are not represented in the current schema.
- Use trade categories; default all services to minor except House & Condominium Renovation (major). Only Emergency Service allows urgent requests.
- Migration `20261019190000_launch_services.sql` adds the confirmed catalog and deactivates the temporary sample entries. It was applied to the linked Supabase project on 2026-10-19 and confirmed in the migration list.

### #27 — Customer account setup after email confirmation
**Date:** 2026-10-19
**Milestone:** Phase 5, customer onboarding

**Decision:**
Collect the customer's name, birthday, Philippine mobile, account type, email, and password at account creation. After authentication, collect the service address and pin and record separate Terms and Privacy Notice consent versions, timestamps, and device. Keep SMS OTP deferred under Q19.

**Consequences:**
- Unauthenticated signup only puts the initial profile fields in Supabase Auth metadata; the customer setup RPC writes them to `profiles` after sign-in.
- The setup RPC creates or updates the customer's Home address and records the two versioned consents. The existing server location route validates the pin and stores it.
- Terms and Privacy pages show clearly labeled temporary placeholders until the legal review in Phase 16. Apply `20261019200000_customer_onboarding.sql` before using this flow; it has not yet been applied or live-checked.


### #28 — Guest pages and sign-in redesign, Cloudflare Turnstile, Google sign-in
**Date:** 2026-10-25
**Milestone:** Phase 5 (accounts), guest pages

**Context:**
The owner asked for the guest pages to follow the layout of the Cup N' Cake reference (top bar with Log in, hero, how it works, services in the middle, a "why" band and a footer with link columns) and for sign in and sign up to follow the PLP Admissions design: split screen, Remember me, Forgot password, Cloudflare check, Continue with Google, and a link to create an account. The owner chose to copy the layout only and keep the MAZ white and navy look (Q1 stays), to include Google sign-in, and to host on Vercel with the shared Supabase project so several laptops see the same data.

**Decision:**
- The guest shell has its own header (logo, Services, How it works, Contact, Log in, Sign up) and a four column footer. It lives in `public-shell.module.css`, so the one-header rule in step 1.23 now covers the three role shells only.
- The guest home page reads active services and their descriptions from the database (cached, falls back to the launch list). New column `services.description`, editable in the admin catalog. Migration `20261025100000_service_descriptions.sql` seeds draft wording only where a description is empty. The owner should replace it with the real card text.
- Sign in and sign up use one split layout (`AuthSplit`). The navy panel is a solid token color (no gradients, per the plan rules).
- Cloudflare Turnstile is checked on the server for log in and for both sign up forms. Sign up now goes through `/api/auth/signup` instead of the browser calling Supabase directly, so the check cannot be skipped. Turnstile is off when `TURNSTILE_SECRET_KEY` is empty.
- Google sign in uses Supabase Auth. After Google, `/auth/confirm` swaps the code for a session and `/auth/continue` sends new customers to `/customer/setup` and everyone else to their role home.
- Remember me: not ticked means session cookies (no expiry), kept by the proxy and server client through a marker cookie.
- New tokens: `--font-size-display` (home and sign in headline only, so the "3 font sizes" test already failing for `--font-size-tiny` stays failing), `--letter-spacing-label`, page, form, logo and badge sizes, on-navy colors and the four Google mark colors.

**Consequences:**
- Google sign in needs the Google provider enabled in Supabase and the site URL and redirect URLs set (see `.env.example`).
- A new Google user is a customer. Someone who wants to be a provider still uses Apply to become a provider.
- Contact details in the footer show only what is filled in `src/lib/public/business-info.ts`.
- The browser Supabase client can still renew a not-remembered session after about an hour on a tab left open; this was not tested.


### #29 — Booking request flow (Phase 6)
**Date:** 2026-10-25
**Milestone:** Phase 6, steps 6.4 to 6.13

**Decision:**
- The customer books through a five step form (service, details and photos, address, when, review) at `/customer/bookings/new`. Answers save automatically as a draft (the `bookings` row in `draft` status), so a customer can leave and resume from the bookings list.
- Photos go in a new private bucket `booking-photos` (JPG, PNG, WebP, 5 MB each, up to 5 per booking). Only the customer of a draft can add or remove photos. The customer, the booking's provider and admin can read them. Offered providers cannot read them yet; Phase 7 decides when they can.
- Submitting runs one database function, `submit_booking`. It repeats every rule on the server (service, description of at least 10 characters, an address with a map pin, a future date or an urgent request for a service that allows it, Terms accepted), sets the job class (major when the customer ticks major renovation or the service is major), records the Terms time, and moves draft to open through `change_booking_status`.
- A customer picks from their saved addresses or adds a new one with the map pin in the form. A booking needs an address that has a pin.
- Contact details from the owner (phones, email, Facebook, hours, "Metro Manila and surrounding areas") and the owner's service wording are now in the guest pages and the service catalog (migrations `20261025100000` and `20261025110000`).
- Provider sign up with Google is added. A person who signs up with Google gives name, birthday and mobile inside the provider application, because Google does not supply them.

**Consequences:**
- Apply `20261025120000_booking_request.sql` before using the form. It has not been applied or live-checked. The submit rules were checked on a scratch database with stand-in tables, not on the real schema.
- Terms acceptance on a booking stores only a time (`terms_accepted_at`), not a Terms version. Add the version if the lawyer review (Q12) needs it.

### #30 — Matching, provider choice and offers (Phase 7)
**Date:** 2026-10-26
**Milestone:** Phase 7, steps 7.1 to 7.30 (answers Q27, Q29, Q31 to Q35)

**Decision:**
- Reliability = accept rate 40%, on-time arrival 30%, no provider cancellations 20%, no no-shows 10% (no-shows are recorded from Phase 10, until then everyone counts as clean). Providers with fewer than 3 finished jobs start at 4.0 stars and 70 reliability. The numbers live in `config` (`ranking.*`).
- Normal jobs: the customer picks from the ranked list (top 5, nearest 15 km). A decline or timeout puts the job back to open and the customer picks again. A tick "offer to the next best automatically" lets the server do it.
- Urgent jobs: the system offers down the ranked list, 15 minutes per offer.
- Three declines or timeouts send any job to the admin queue.
- Large jobs (a major renovation, or P80,000 and up once a quote exists in Phase 9): skip the customer pick. Admin assigns one foreman from the ranked list. The customer can ask for a change with a reason and admin decides. Foreman only, no crew at launch.
- Ranking runs in TypeScript (`src/lib/matching`). SQL decides who may be offered a job and guards the state machine. Expired offers are handled when a page loads and by `/api/jobs/expire-offers` for a scheduled worker (Q40).
- Every ranked list with its scores, every pick and every offer result is written to the audit log.

**Consequences:** Offered providers still do not see customer contact details before accepting. A scheduler must call `/api/jobs/expire-offers` for timeouts to fire when nobody opens a page.

### #31 — Address form, Terms and settings clean-up
**Date:** 2026-10-26

**Decision:**
- Address forms (account setup and booking) use a Metro Manila city list and then a barangay list for that city. The Province field is removed. The map pin stays the way to confirm the exact place.
- Terms version 1.1 is written from the project rules (provider choice, deposit tiers, cancellation, messages, photos). It is a draft until the lawyer review in Phase 16.4 (migration `20261026110000`).
- "Show avatars in lists" is removed from Appearance. It only hid small initials circles and nobody needed it.
- Settings is one centered column of cards (profile, appearance, password), following the PLP layout.
- Change password now sends the current password to Supabase with the new one. Projects with "secure password change" on reject the update without it.

### #32 — Job alerts and "I can do this"
**Date:** 2026-10-26

**Decision:**
- When a normal job opens, every approved provider who declared that service on their profile gets an in-app and email alert, once per job. Matching is by declared skills, not distance. Urgent jobs (offered one by one) and large jobs (admin assigns) do not send these alerts.
- Providers see these jobs on their home screen under "Customers looking for your skills" (service, area, distance, date, description; no name, street or contact) and can tap "I can do this" or take it back.
- "I can do this" is a yes in advance. The customer is told, and that provider may be chosen even when beyond 15 km.
- On the customer's list, providers within 15 km come first. Only if fewer than 5 are near, providers who said yes fill the rest, even if far, tagged "Farther away, but says yes". A far provider who has not said yes is never listed.
- Migration `20261026120000_open_requests_interest.sql`.

