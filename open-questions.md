# open-questions.md

---
## AI RULES — READ FULLY BEFORE ANY ACTION
---

1. Read this file at the start of every session and at every
   major milestone.
2. Section 1 questions are hard blockers. Do not write any code
   or make any structural decision until all Section 1 questions
   are answered by the human.
3. Section 2 questions are active blockers. Do not pass the
   milestone they are tagged to without resolving them first.
4. When uncertain mid-build → do not guess. Add a question to
   Section 2 with its milestone tag, flag it to the human, and
   wait for an answer before continuing.
5. When a question is answered → move it to the Resolved log
   at the bottom. Never delete questions — resolved ones become
   part of the project's decision history.
6. Never answer your own questions with assumptions. If a question
   is here, it means a human decision is required.

---
## SECTION 1 — BEFORE STARTING
---
These must all be answered before any code is written.
If any are blank → stop and ask.
Status as of 2026-10-16: all 11 answered. Details are copied to the Resolved log.

| # | Question | Answer |
|---|----------|--------|
| 1 | Base look | All white, black text |
| 2 | Cancellation fee | Minor: flat P1,500 taken from deposit. Major: real costs so far, capped at the deposit. Confirmed by owner |
| 3 | Payment tiers | Minor under P20,000; Standard P20,000 to P79,999; Large P80,000 and up or major renovation. Rules in phases-plan.md Locked Decisions |
| 4 | Provider rate | Fixed rate per day worked. Admin can override per job with a reason. Pay per milestone on milestone jobs. Confirmed by owner |
| 5 | Signature | On screen at Done. Admin override with a reason |
| 6 | Payments outside the system | Balance may be paid in cash to the owner or admin only. Providers never collect. Confirmed by owner |
| 7 | GPS radius | 200 m from the job pin. Admin override when GPS fails, reason required |
| 8 | Sign up fields | As listed in phases-plan.md Phase 4 (4.1 customer, 4.6 provider) |
| 9 | Cash payroll | Owner or admin hands over the cash. Provider signs the printed slip. Admin marks it paid |
| 10 | Vector logo | Text placeholder until the real logo arrives. Swap in Phase 16 (step 16.6) |
| 11 | PayMongo test account and wallet | Create the free test account now. Wallet only needed for provider payouts, Phase 11 |

---
## SECTION 2 — ACTIVE DURING BUILD
---
Questions that surfaced mid-project.
Each question is tagged to the milestone where it must be resolved.

| # | Question | Milestone | Answered? |
|---|----------|-----------|-----------|
| 12 | Lawyer review: Data Privacy Act duties, ID and selfie storage, Terms and Privacy wording, cancellation fee legality | Phase 16 | [ ] |
| 13 | Accountant review: do system receipts replace BIR registered receipts, tax type, how fees and cash are recorded | Phase 16 | [ ] |
| 14 | Hosted tile provider and geocoder for production. Read each free plan's terms before choosing | Phase 3 | [ ] |
| 18 | When is the deposit paid: after the provider accepts and the customer accepts the quote, or at request? | Phase 7 | [ ] |
| 19 | SMS provider for mobile OTP and urgent offer alerts. Email alone is too slow for a 15 minute window | Phase 2 | [ ] |
| 20 | How long are ID and selfie files kept, and who can view them? | Phase 4 | [ ] |
| 21 | If no provider is found or a provider cancels, is the deposit refunded in full or held for rematch? | Phase 10 | [ ] |
| 22 | Launch service areas and launch service list | Phase 5 | [ ] |
| 23 | Days before an unpaid balance blocks new bookings. Days before auto confirm of a milestone | Phase 9 and 10 | [ ] |
| 24 | Extra work during a job: who approves and how the deposit changes | Phase 9 | [ ] |
| 25 | Hosting and domain, and who owns the accounts | Phase 17 | [ ] |
| 26 | Deposit size. The plan locks 50 percent. Common guidance for home jobs is lower (20 to 25 percent for materials heavy work) and a consumer agency advises paying in traceable stages. Keep 50 percent for every tier, or lower it for Minor jobs? | Phase 7 | [ ] |
| 27 | Reliability score formula (accept rate, on time arrival, provider cancellations, no shows) and the new provider starting rating | Phase 6 | [ ] |
| 28 | How the 10 percent customer holdback maps to provider pay on Large jobs | Phase 11 | [ ] |
| 29 | Default for the urgent offer window. Plan uses 15 minutes, owner to confirm | Phase 6 | [ ] |
| 31 | Urgent jobs: system offers down the ranked list (recommended, because the customer cannot wait to re-pick), or the customer picks like normal jobs? | Phase 7 | [ ] |
| 32 | Which jobs get an admin assigned foreman? Recommended: Large tier only (P80,000 and up or major renovation). Owner had no preference, so this is a working default | Phase 7 | [ ] |
| 33 | Customer say on the foreman. Recommended: admin assigns, customer can ask for a change, admin decides. Working default | Phase 7 | [ ] |
| 34 | Crew under a foreman. Recommended: foreman only at launch, crew support after launch (pay, check in and chat need new rules). Working default | Phase 7 | [ ] |
| 35 | When the picked provider declines or times out. Recommended: customer picks again, with an optional tick to auto offer the next best. After 3 misses, admin. Owner asked for a recommendation, please confirm | Phase 7 | [ ] |

Note: numbers 15 to 17 are not in phases-plan.md. If your earlier filled file used them, add them back here so no number is lost.

---
## HOW TO ADD A QUESTION (AI instructions)
---

When you hit uncertainty mid-build:
1. Stop what you are doing
2. Write the question clearly and specifically —
   not "what should I do here?" but "should the user
   profile data be fetched on login or on page load,
   given that X and Y are both affected by this choice?"
3. Tag it to the nearest upcoming milestone
4. Tell the human: "I've added a question to open-questions.md
   before I can continue. See question #[N]."
5. Wait for the answer before proceeding

---
## RESOLVED QUESTIONS
---
Answered questions live here permanently as part of project history.
The original R1 to R16 from the earlier filled file are not in this copy. Merge them here when you have them. R15 (machine learning recommender, planned after launch) is referenced by phases-plan.md 18.4.

| # | Question | Answer | Resolved At |
|---|----------|--------|-------------|
| Q1 | Base look | All white, black text | Before 2026-10-16 |
| Q3 | Payment tiers | Minor / Standard / Large as in Locked Decisions | Before 2026-10-16 |
| Q5 | Signature | On screen at Done | Before 2026-10-16 |
| Q8 | Sign up fields | As listed in the plan | 2026-10-16 |
| Q7 | GPS radius | 200 m, admin override with reason | 2026-10-16 |
| Q9 | Cash payroll | Owner or admin pays, provider signs slip, admin marks paid | 2026-10-16 |
| Q10 | Vector logo | Text placeholder allowed | 2026-10-16 |
| Q11 | PayMongo test account and wallet | Test account now, wallet in Phase 11. Account creation still to be done by owner | 2026-10-16 |
| Q2 | Cancellation fee | Flat P1,500 minor, real costs capped at deposit for major | 2026-10-16 |
| Q4 | Provider rate | Per day, admin override per job, pay per milestone | 2026-10-16 |
| Q6 | Payments outside the system | Cash to owner or admin only, never to providers | 2026-10-16 |
| Q30 | Next.js app location | Confirmed: the app lives in this same folder (package.json, src and supabase are in the project root) | 2026-10-17 |
| Q36 | Token check (step 1.22) exceptions: media query widths 40rem and 48rem, and skipping src/app/globals.css | Owner said "do what you recommend". Allow media query widths 40rem and 48rem only (media queries cannot read custom properties). Scan globals.css too: its raw values moved into tokens.css (--size-viewport-width, --size-sr-only, --duration-reduced-motion). See decision-log.md #11 | 2026-10-17 |
