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
Option A. Keep the OpenStreetMap attribution visible. Choose the production tile provider and geocoder in Phase 3 (Q14).

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
