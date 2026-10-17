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