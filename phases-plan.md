# phases-plan.md

Build order for Capstone, a home services booking platform (customers, providers, admin).
Stack: Next.js, Supabase (PostGIS), Resend, PayMongo, Leaflet with OpenStreetMap.
Scale: Medium. Feature based folders.
Updated: 2026-10-17

Status: Phase 0 signed off. Phase 1 setup and design plan (1.12 to 1.15) are done. Tokens, contrast, button rules and the font size engine (1.16 to 1.19) are done. Layout shells (1.20) are done. Base components (1.21) are next.
Change 2026-10-17: customer picks the provider from a ranked list. Large jobs get an admin assigned foreman. See decision-log.md entry 7.

---
## HOW TO USE THIS FILE
---

- Work top to bottom. Do not start a phase until the one before it is signed off.
- Do subphases in order. Tick each box when done and tested.
- Every phase ends with a gate. The gate must pass before the next phase.
- Send this file with the other md files at the start of each session.

### Rules for every subphase

1. Read open-questions.md, decision-log.md, constraints.md, architecture-notes.md and ux-ui-guidelines.md first.
2. Map every connected file before touching anything.
3. Check if the thing already exists before building it.
4. Automate first. Add UI only where a human must decide.
5. Unsure? Add a question to open-questions.md and wait. Do not guess.
6. No hardcoded visual values. Colors, sizes, spacing and radius come from tokens.
7. No emojis, glows, gradients or single side colored borders.
8. Every screen has all states: default, hover, focus, loading, success, error, empty, disabled.
9. Check every screen on a small phone and on desktop.
10. Every schema change is a migration file. Never edit the database by hand.
11. Every rule that moves money or changes a booking status has a test.
12. Secrets stay on the server. Never commit keys.
13. Each phase builds its own admin queue and audit log entries. Phase 15 only completes them.
14. Copy is plain. Sentence case. A button says what it does. An error says what to fix.

### Gate checklist (run at the end of every phase)

- [ ] All subphases done and tested
- [ ] architecture-notes.md updated
- [ ] decision-log.md entry added for hard to reverse choices
- [ ] open-questions.md updated, no unresolved question tagged to this phase
- [ ] Changes committed to Git
- [ ] Owner confirmed

---
## LOCKED DECISIONS
---

| Topic | Decision |
|---|---|
| Base look | All white, black text |
| Primary button | Navy, white text, darker navy on hover |
| Secondary button | White, black text and border, navy with white text on hover |
| Font size | User setting in Settings, 4 levels, all roles |
| Deposit | 50 percent, always through the system (see Q26) |
| Balance | Customer chooses system or cash to owner |
| Cash | Owner or admin records it with reference and proof photo. Providers never collect |
| Provider pay | Fixed rate per day worked. Materials reimbursed from receipt |
| Minor job | Quote under P20,000. 50 percent deposit, 50 percent on completion |
| Standard job | P20,000 to P79,999. Same split. One midpoint check if over 3 days |
| Large job | P80,000 and up, or major renovation. 50 percent deposit, 40 percent across milestones, 10 percent held until the punch list is confirmed |
| Cancel fee, minor | Flat P1,500 taken from deposit |
| Cancel fee, major | Real costs so far, capped at the deposit |
| Provider cancels | No fee to customer. Counts against provider reliability |
| After provider accepts | Customer cannot cancel. Provider cancels in the system |
| After provider is on the way | No cancel |
| Offer window | 30 minutes normal. Urgent 15 minutes (owner to confirm, Q29) |
| Provider choice, normal jobs | System recommends a ranked list. The customer picks the provider. The offer goes to the picked provider |
| Offer chain, normal jobs | If the picked provider declines or times out, the customer is told and picks again. Optional tick: offer to the next best automatically. After 3 declined or timed out offers the job goes to admin (Q35) |
| Urgent jobs | System offers down the ranked list. 3 misses, then admin (Q31, recommended) |
| Large jobs | Admin assigns a foreman. Customer sees the foreman and can ask for a change. Admin decides. Foreman only at launch, crew support after launch (Q32 to Q34, recommended) |
| Ranking, normal | Distance 30, rating 35, reliability 20, past jobs 15. Hard filter 15 km |
| Ranking, urgent | Distance 40, reliability 25, rating 25, past jobs 10. Hard filter 15 km |
| Signature | On screen at Done. Admin override with a reason |
| Arrival check | 200 m from job pin. Admin override when GPS fails |
| Map | OpenStreetMap with Leaflet |
| Chat | Admin reads all threads |
| Reviews | After Completed and balance paid. One per booking. Admin can hide |
| Log out | Confirm first, list open items, flag admin, items stay as they are |
| Icons | Lucide |
| Project name | Capstone |

---
## PHASE 0. PLANNING GATES (done)
---

Goal: no code until the blockers are closed.

- [x] 0.1 Read every md file in the project folder
- [x] 0.2 Fill open-questions.md
- [x] 0.3 Add the new questions to open-questions.md
- [x] 0.4 Close Section 1 (no blank row)
- [x] 0.5 Fill project-brief.md (name: Capstone)
- [x] 0.6 Fill architecture-notes.md (scale Medium, stack, project type)
- [x] 0.7 Add decision-log.md entries: stack, map, button color, payment tiers, signature, cancellation
- [x] 0.8 Owner signs off on Phase 0

Gate: Section 1 has no blank row. Passed.

---
## PHASE 1. FOUNDATION AND DESIGN SYSTEM
---

Goal: empty app with tokens, shells and base components.

Setup
- [x] 1.1 Scan the folder. Result: planning files only, no code
- [x] 1.2 Folder structure approved by the owner
- [x] 1.3 Install Node LTS, Git, VS Code
- [x] 1.4 Create the Next.js app in a temporary subfolder, move it into the project folder, rename it capstone, run git init, first commit
- [x] 1.5 Run npm run dev. Confirm the starter page loads at localhost:3000
- [x] 1.6 Create only the folders needed now: src/app, src/components/ui, src/components/layout, src/lib, src/styles, supabase/migrations, tests. Feature folders are made in their own phase
- [x] 1.7 Install packages: leaflet, react-leaflet, @types/leaflet, @supabase/supabase-js, @supabase/ssr, resend, signature_pad, zod, react-hook-form, date-fns, lucide-react
- [x] 1.8 Install test tools: a unit test runner, a component test library, an end to end test tool
- [x] 1.9 Add scripts: lint, typecheck, test, format. Confirm each runs clean
- [x] 1.10 Create .env.local and .env.example. Confirm .gitignore blocks .env.local. Test keys only
- [x] 1.11 Icon library: Lucide

Design
- [x] 1.12 Find 2 to 3 reference products for the booking flow, provider job screen and admin tables. Show the owner
- [x] 1.13 Write a short design plan before any component code: palette (4 to 6 named values), type choices and roles, layout notes, wireframes of the 4 shells
- [x] 1.14 Check the plan against the locked look. Remove anything that reads as a template default. The locked decisions win over any style advice
- [x] 1.15 Owner approves the design plan
- [x] 1.16 Define tokens
  - Colors: white surface, near black text, navy accent, grays, success, warning, error
  - Spacing: 8px grid, 4px for tight gaps
  - Radius: 8 and 16 only
  - Font sizes: 3 tokens in rem
  - Font weights: 400 and 600
  - Header height, tap target size, shadow, button and input dimensions
- [x] 1.17 Check contrast: text 4.5 to 1, buttons and borders 3 to 1
- [x] 1.18 Define button rules from Locked Decisions. One primary per screen. On phones the primary sits above the secondary. Owner confirms
- [x] 1.19 Build the font size engine
  - 4 levels: Small, Medium, Large, Extra large
  - Set on the root element, all sizes in rem
  - Test every base component at all 4 levels
  - Engine tested now (levels, root sizes, init script, control). The per component check at all 4 levels repeats in 1.21 as each base component is built
- [x] 1.20 Build layout shells: public, customer, provider, admin
  - Fixed header height token
  - Mobile: bottom tab bar. Admin shows 4 items plus More
  - Desktop: top bar or left sidebar only for multi section areas
  - Booking and sign up use a stepper, no sidebar
- [ ] 1.21 Build base components with all states: button, input, select, checkbox, radio, modal, toast, table, list, stepper, empty state, file upload
- [ ] 1.22 Add a check script that fails on raw colors, sizes or radius in components
- [ ] 1.23 Check: header is identical on every page, keyboard focus is visible, reduced motion is respected

Gate: shells render, tokens only, font size works, owner approves the look.

---
## PHASE 2. DATABASE, AUTH, ROLES
---

Goal: data model and secure access before any feature.

Project and tooling
- [ ] 2.1 Create the Supabase project in the region closest to the Philippines
- [ ] 2.2 Enable PostGIS
- [ ] 2.3 Install the Supabase CLI. Link the project. Keep all schema as migration files run in order
- [ ] 2.4 Answer Q19 (SMS provider) before 2.17

Schema
- [ ] 2.5 Core tables: profiles, addresses, provider_profiles, provider_documents, services, provider_services, user_settings, config
- [ ] 2.6 Job tables: bookings, offers, quotes, milestones, work_days, materials, punch_items, signatures
- [ ] 2.7 Money tables: payments, cash_records, cancellations, payouts, payout_slips, receipts
- [ ] 2.8 Other tables: messages, reviews, notifications, consents, legal_versions, audit_log
- [ ] 2.9 Booking status list and allowed moves. Owner confirms
  - draft, open, offered, accepted, quoted, deposit_paid, scheduled, on_the_way, in_progress, done, signed, balance_paid, completed, cancelled
- [ ] 2.10 Enforce allowed moves in one database function. No other code may change a status
- [ ] 2.11 Seed the config table: weights, windows, fees, tier thresholds, chain limit
- [ ] 2.12 Audit log helper. Every override and config change writes a row

Access
- [ ] 2.13 Row level security for each table and role (customer, provider, admin)
- [ ] 2.14 Admin can read all chat threads
- [ ] 2.15 Private storage buckets: ids, selfies, receipts, proof photos, signatures. Signed links only. Set file type and size limits
- [ ] 2.16 Email and password auth, email verification, password reset through Resend. Set up the Resend sender
- [ ] 2.17 Mobile number OTP. Blocked until Q19 is answered
- [ ] 2.18 Route guards for each role
- [ ] 2.19 Seed data: one test user per role, sample services

Tests
- [ ] 2.20 Each role tries to read and write data it should not reach
- [ ] 2.21 Run all migrations on an empty database

Gate: no role can reach another role's data. Migrations run clean on an empty database.

---
## PHASE 3. NOTIFICATIONS BASE
---

Goal: the system can reach the right person. Later phases only add events.

- [ ] 3.1 List every event and who gets it. Save the list in architecture-notes.md
- [ ] 3.2 Notification send function with one interface for email, in app and fast alert
- [ ] 3.3 Email templates through Resend: one base layout, plain text version, sender and reply address
- [ ] 3.4 In app notification list and unread badge
- [ ] 3.5 Fast alert channel for offers and urgent jobs, based on the Q19 answer
- [ ] 3.6 Send log with retry on failure and an admin alert after repeated failure
- [ ] 3.7 Store notification choices per user. The screen comes in Phase 5
- [ ] 3.8 Tests: email, in app and fast alert each arrive in test mode, with timing recorded

Gate: a test event reaches email and in app. A fast alert reaches a phone well inside 15 minutes.

---
## PHASE 4. MAP AND LOCATION
---

Goal: pins, search, distance and arrival check.

- [ ] 4.1 Choose the hosted tile provider and geocoder. Read each free plan's terms. Answer Q14
- [ ] 4.2 Build the map component. Load in the browser only. Keep the OpenStreetMap attribution visible
- [ ] 4.3 Draggable pin and a current location button
- [ ] 4.4 Address search with debounce. Send it through the server. Respect the provider's rate limit and send a proper User-Agent
- [ ] 4.5 Save latitude and longitude as a PostGIS point. Longitude first
- [ ] 4.6 Check the pin falls inside the Philippines, on the server too
- [ ] 4.7 Landmark text field. Used when search fails
- [ ] 4.8 SQL function: approved providers within a radius, sorted by distance
- [ ] 4.9 Server side arrival check: provider position within 200 m of the job pin. Save distance and GPS accuracy
- [ ] 4.10 Request admin override when GPS fails. Reason required, logged
- [ ] 4.11 States: permission denied, no signal, search empty, search failed
- [ ] 4.12 Tests: point order, distance sort, arrival pass and fail at 199 m and 201 m
- [ ] 4.13 Test on a real phone over HTTPS

Gate: a pin saves, distance sorts correctly, arrival check passes and fails as expected.

---
## PHASE 5. ACCOUNTS AND ONBOARDING
---

Goal: people can sign up and providers can be approved.

Customer
- [ ] 5.1 Answer Q20 (how long ID and selfie files are kept, who can view them) before storing any real ID
- [ ] 5.2 Sign up fields: first name, last name, birthday (18 or older), mobile, email, password, address with pin, household or business, consent
- [ ] 5.3 Business type shows a business name field
- [ ] 5.4 Block under 18 with a clear message
- [ ] 5.5 Consent boxes for Terms and Privacy Notice. Save version, time and device
- [ ] 5.6 Email verification and mobile OTP
- [ ] 5.7 Placeholder Terms and Privacy pages so consent works before legal review

Provider
- [ ] 5.8 Provider application: all customer fields plus government ID, selfie, skills and services, base location and service area, daily rate, payout method (GCash, bank or cash), emergency contact, NBI clearance if required
- [ ] 5.9 Show a privacy notice next to each ID and selfie upload
- [ ] 5.10 Provider status: pending, approved, rejected, suspended. Hidden from customers until approved
- [ ] 5.11 Admin review screen: view documents, approve or reject with a reason, email the result
- [ ] 5.12 Admin queue: provider approvals

Settings and session
- [ ] 5.13 Settings page
  - Font size (all roles)
  - Profile and password
  - Payout method (provider)
  - Notification choices
- [ ] 5.14 Log out flow: confirm, list open items, flag admin, items stay as they are
- [ ] 5.15 Admin queue: log out flags
- [ ] 5.16 Tests: under 18 block, wrong role access, font size saves per user

Gate: customer and provider sign up end to end. Admin approves a provider. Font size saves per user.

---
## PHASE 6. SERVICES AND BOOKING REQUEST
---

Goal: a customer can submit a request.

- [ ] 6.1 Answer Q22 (launch areas and launch services)
- [ ] 6.2 Service catalog: category, name, default minor or major flag, urgent allowed flag
- [ ] 6.3 Admin screen to add and edit services
- [ ] 6.4 Booking stepper: service, details and photos, address pin, date and time or urgent, review
- [ ] 6.5 Customer marks major renovation of house or condo. This sets the major flag
- [ ] 6.6 Urgent switch. Only for services that allow it
- [ ] 6.7 Terms step: must be read and confirmed. Customer can leave before the final booking
- [ ] 6.8 Auto save draft
- [ ] 6.9 Disabled submit button shows exactly what is missing
- [ ] 6.10 Status moves draft to open through the status function only. Open means submitted and waiting for a provider pick or an admin assignment
- [ ] 6.11 Customer booking list and detail with status
- [ ] 6.12 Empty, loading and error states
- [ ] 6.13 Tests: draft resume, missing field messages, major flag saved

Gate: a request saves with all fields, pin and flags, and shows in the customer's list.

---
## PHASE 7. MATCHING, PROVIDER CHOICE AND OFFERS
---

Goal: the system recommends providers. The customer picks one. Large jobs get a foreman from admin.

Scoring
- [ ] 7.1 Answer Q27. Define reliability: accept rate, on time arrival, provider cancellations, no shows. Owner confirms the formula
- [ ] 7.2 Rating comes from the review average. Past jobs is the count of completed jobs
- [ ] 7.3 New provider rule: neutral starting rating and reliability. Owner confirms
- [ ] 7.4 Hard filters: approved, offers this service, within 15 km, free on that date, not suspended
- [ ] 7.5 Score function reads weights from the config table, not from code. Normal and urgent weights are stored separately
- [ ] 7.6 Log every score for later tuning

Customer choice (normal jobs)
- [ ] 7.7 Answer Q35 (what happens when the picked provider declines)
- [ ] 7.8 Ranked list after the request is submitted: top 5 providers with first name, rating, distance, past jobs, a reliability badge and the daily rate. No contact details
- [ ] 7.9 Mark one provider as best match and say why in plain words
- [ ] 7.10 Customer picks one provider. Status moves open to offered
- [ ] 7.11 Offer goes to the picked provider. Window is read from config: 30 minutes normal
- [ ] 7.12 Server side timer to expire offers
- [ ] 7.13 If the provider declines or times out: notify the customer, remove that provider from the list, customer picks again
- [ ] 7.14 Optional tick on the pick screen: if declined, offer to the next best automatically
- [ ] 7.15 Count the misses. After 3 declined or timed out offers the job goes to the admin queue

Urgent jobs
- [ ] 7.16 Answer Q31. If confirmed, the system offers down the ranked list. Window 15 minutes (Q29). Same 3 miss limit, then admin

Large jobs
- [ ] 7.17 Answer Q32 to Q34 (which jobs, customer say, crew)
- [ ] 7.18 Large jobs skip the customer pick. They go to the admin queue: foreman assignment
- [ ] 7.19 Admin sees the ranked list and assigns a foreman. The foreman gets the offer and accepts or declines
- [ ] 7.20 Customer sees the foreman profile and can ask for a change with a reason. Admin decides. Log it
- [ ] 7.21 One foreman per job at launch. Crew support is planned for after launch

Provider side and admin
- [ ] 7.22 Provider offer screen: service, area, distance, daily rate, date. No customer contact details before accept
- [ ] 7.23 Accept and decline actions. Decline can take a reason
- [ ] 7.24 Send new offer alerts through the Phase 3 fast channel. Send the customer a notice when their pick answers
- [ ] 7.25 Admin queues: unassigned jobs and foreman assignment. Admin can assign any job by hand with a reason
- [ ] 7.26 Log every list shown, every pick and every offer result

Tests
- [ ] 7.27 Ranking examples, tie breaks, urgent weights
- [ ] 7.28 Pick, decline, pick again, 3 misses, optional auto offer
- [ ] 7.29 Urgent chain and timeouts
- [ ] 7.30 Large job skips the customer pick. Foreman change request works. A provider cannot see customer contact details before accept

Gate: a customer picks from the ranked list, the offer reaches that provider, a decline sends the customer back to pick again, and 3 misses land in the admin queue. A large job reaches admin for a foreman.

---
## PHASE 8. CHAT
---

Goal: customer and provider talk, admin can read.

- [ ] 8.1 One thread per booking, created when the provider accepts
- [ ] 8.2 Live messages with Supabase realtime
- [ ] 8.3 Text and photos, with upload limits
- [ ] 8.4 Unread count and notification through Phase 3
- [ ] 8.5 Admin can open any thread
- [ ] 8.6 Admin can flag a message
- [ ] 8.7 Notice in Terms and Privacy that admin can read threads
- [ ] 8.8 States: empty, sending, failed, retry
- [ ] 8.9 Tests: other users cannot read the thread, admin can

Gate: both sides chat live, admin can read, other users cannot.

---
## PHASE 9. QUOTE, INSPECTION AND DEPOSIT
---

Goal: agreed price and paid deposit.

Quote
- [ ] 9.1 Answer Q18 (when the deposit is paid) and Q26 (deposit size). Confirm the order: provider accepts, then quote, then customer accepts and pays deposit
- [ ] 9.2 Inspection visit for major jobs: arrival check, notes, photos
- [ ] 9.3 Provider proposes minor or major class and a quote. On large jobs the foreman proposes
- [ ] 9.4 Admin approves the class and quote. Customer sees it and accepts or declines
- [ ] 9.5 Quote expiry if the customer does not answer
- [ ] 9.6 Payment tier is picked from the quote value and the major flag, using config thresholds
- [ ] 9.7 Milestone builder for large jobs: 2 to 4 milestones, each with a checkable description and amount. Total is 40 percent. Holdback is 10 percent

Deposit
- [ ] 9.8 Create the PayMongo test account. Keys stay on the server only
- [ ] 9.9 Deposit: create a payment for 50 percent. Methods: card, GCash, Maya, GrabPay, QR Ph
- [ ] 9.10 Handle redirects and 3DS
- [ ] 9.11 Webhook: verify the signature, handle repeats safely, update payment and booking
- [ ] 9.12 Failure states: declined, abandoned, expired, retry
- [ ] 9.13 Payment acknowledgment for the deposit
- [ ] 9.14 After deposit the booking is confirmed and the customer cancel button is gone

Tests
- [ ] 9.15 Test cards, e-wallet authorize and fail, QR Ph test URL. Never scan a test QR
- [ ] 9.16 Send the same webhook twice. The booking changes once

Gate: test deposit succeeds and fails correctly, webhook updates the booking once.

---
## PHASE 10. JOB EXECUTION
---

Goal: the work, tracked from schedule to signature.

Schedule and arrival
- [ ] 10.1 Confirm the schedule. Send reminders
- [ ] 10.2 On the way button. After it, no cancel for anyone on the customer side
- [ ] 10.3 Daily check in with the 200 m rule. Creates a work day record
- [ ] 10.4 End of day: provider closes the day with photos

Money during the job
- [ ] 10.5 Materials: provider uploads receipt photo and amount. Customer sees it. Approved amount is reimbursed
- [ ] 10.6 Answer Q23. Milestone submit by provider, confirm by customer. Auto confirm after the agreed number of days
- [ ] 10.7 Answer Q24. Extra work: provider proposes, admin approves, customer accepts, price updates

Finish
- [ ] 10.8 Punch list: provider lists leftover fixes, customer confirms each
- [ ] 10.9 Mark Done by provider
- [ ] 10.10 On screen signature pad. Customer signs on their phone or the provider's phone. Saves image, time, location and signer
- [ ] 10.11 Signature also covers the materials receipts
- [ ] 10.12 Admin override if the customer refuses. Reason required, logged
- [ ] 10.13 Admin queues: GPS overrides and signature overrides
- [ ] 10.14 Final photos
- [ ] 10.15 Tests: signature cannot be edited after saving, check in fails at 201 m, auto confirm fires on time

Gate: a full test job runs from schedule to signed Done with every record saved.

---
## PHASE 11. BALANCE AND CASH
---

Goal: the customer pays the rest.

- [ ] 11.1 Balance becomes due when the job is Done
- [ ] 11.2 Customer chooses system payment or cash
- [ ] 11.3 System payment of the balance, same flow as the deposit
- [ ] 11.4 Cash: customer and owner agree the place in chat
- [ ] 11.5 Owner or admin records amount, date, reference, proof photo and the customer's signature. Then marks paid
- [ ] 11.6 Providers cannot collect or record customer cash. Block it in code and in RLS
- [ ] 11.7 Unpaid balance: reminders, block new bookings and reviews, admin follow up list. Days set by Q23
- [ ] 11.8 Admin queues: cash records and unpaid balances
- [ ] 11.9 Final payment acknowledgment with all amounts
- [ ] 11.10 Tests: both balance paths, provider blocked from cash records, block after the set days

Gate: both balance paths end in balance_paid with correct amounts.

---
## PHASE 12. CANCELLATION AND REFUNDS
---

Goal: every cancel case ends with the right money.

- [ ] 12.1 Answer Q21 (deposit when no provider is found or a provider cancels)
- [ ] 12.2 Cancellation engine
  - Minor: flat P1,500 from deposit
  - Major: assessed cost, capped at deposit
  - Customer declines quote after provider accepted: fee applies
  - Provider cancels: no fee, reliability drops
  - After on the way: blocked
- [ ] 12.3 Major fee form for admin: inspection, materials, days worked, proof. Customer sees the breakdown
- [ ] 12.4 Refund the rest of the deposit through PayMongo
- [ ] 12.5 Handle the refund webhook safely
- [ ] 12.6 Provider cancel flow: reason, notify customer, rematch through the offer chain
- [ ] 12.7 Dispute flag and admin notes. Payouts pause on a dispute
- [ ] 12.8 Admin queue: disputes
- [ ] 12.9 Cancellation acknowledgment with all amounts
- [ ] 12.10 Tests: every cancel case with exact amounts, fee never above the deposit

Gate: every cancel case tested with correct amounts.

---
## PHASE 13. PROVIDER PAY
---

Goal: providers are paid correctly.

- [ ] 13.1 Pay = confirmed work days x daily rate + approved materials
- [ ] 13.2 Admin can override the rate per job. Reason required
- [ ] 13.3 Milestone jobs: pay per milestone for days worked inside it
- [ ] 13.4 Answer Q28. Last payout waits for the punch list
- [ ] 13.5 Payout method from the provider profile: GCash, bank or cash
- [ ] 13.6 Digital payout through PayMongo disbursement. Needs the wallet. Test first
- [ ] 13.7 Cash payout: print the slip, provider signs, admin marks paid
- [ ] 13.8 Payout ledger and CSV export
- [ ] 13.9 Provider earnings screen
- [ ] 13.10 Failed payout: retry and admin alert
- [ ] 13.11 Admin queue: payouts
- [ ] 13.12 Tests: pay math for each job tier, payout paused during a dispute

Gate: test payouts for each method match the ledger.

---
## PHASE 14. REVIEWS
---

Goal: ratings that feed matching.

- [ ] 14.1 Review opens after Completed and balance paid
- [ ] 14.2 One review per booking: stars and comment
- [ ] 14.3 Rating average feeds the recommender
- [ ] 14.4 Admin can hide a review with a reason. Hidden reviews leave the average
- [ ] 14.5 Reviews show on the provider profile
- [ ] 14.6 Tests: second review blocked, hidden review leaves the score

Gate: a review changes the provider's score. A hidden review does not.

---
## PHASE 15. ADMIN CONSOLE
---

Goal: one place to act on everything.

- [ ] 15.1 Dashboard shows only items that need action
- [ ] 15.2 Confirm every queue exists and opens: provider approvals, unassigned jobs, disputes, cash records, unpaid balances, payouts, GPS overrides, signature overrides, log out flags
- [ ] 15.3 Booking list and detail with full timeline
- [ ] 15.4 Users and providers: view, suspend, restore
- [ ] 15.5 Config editor: weights, windows, fees, thresholds, chain limit. Every change logged
- [ ] 15.6 Chat viewer
- [ ] 15.7 Audit log with filters
- [ ] 15.8 Reports: deposits, balances, cash, payouts, cancellations. CSV export
- [ ] 15.9 Mobile layout with 4 tabs plus More
- [ ] 15.10 Run one full day as admin without touching the database

Gate: admin can run a full day without touching the database.

---
## PHASE 16. LEGAL AND RECEIPTS
---

Goal: real wording and valid receipts.

- [ ] 16.1 Draft Terms, Privacy Notice, Unpaid Balance Policy, Cancellation Policy
- [ ] 16.2 Public pages, footer links, shown at sign up and booking
- [ ] 16.3 Version each document. Log which version each user accepted
- [ ] 16.4 Lawyer review. Include Data Privacy Act duties, ID storage, e-signature and cancellation fees. Answer Q12
- [ ] 16.5 Accountant review. Do system receipts replace BIR registered receipts. Tax type. How fees and cash are recorded. Answer Q13
- [ ] 16.6 Receipt PDF template with logo, TIN, numbering. Swap the placeholder for the vector logo when it arrives
- [ ] 16.7 Data request flow: export and delete
- [ ] 16.8 Replace draft text with approved text

Gate: lawyer and accountant answers recorded in decision-log.md.

---
## PHASE 17. QA AND SECURITY
---

Goal: find problems before real money and users.

- [ ] 17.1 End to end test per role
- [ ] 17.2 Full payment test list: cards, e-wallets, QR Ph, 3DS, declines, refunds, payouts
- [ ] 17.3 Permission tests: try to reach other users' data
- [ ] 17.4 Security: secrets, webhook checks, rate limits, upload checks, input checks
- [ ] 17.5 Accessibility: contrast, keyboard, tap size, all 4 font levels
- [ ] 17.6 Responsive check from small phone to desktop
- [ ] 17.7 Slow network test on a phone
- [ ] 17.8 Token audit: no raw values, header identical on every page
- [ ] 17.9 Trial with real people: 5 customers, 3 providers, 1 admin
- [ ] 17.10 Fix list, retest, close

Gate: no open blocker bugs. Owner signs off.

---
## PHASE 18. LAUNCH
---

Goal: go live safely.

- [ ] 18.1 Answer Q25. Hosting, domain, production env values
- [ ] 18.2 Production Supabase project with backups on
- [ ] 18.3 PayMongo live account and business checks. Swap to live keys
- [ ] 18.4 One small real payment and refund test
- [ ] 18.5 Production map tile plan and usage limits
- [ ] 18.6 Error tracking, uptime checks, webhook failure alerts
- [ ] 18.7 Written admin guide: cash recording, overrides, disputes, payouts
- [ ] 18.8 Soft launch in a small area with a few providers
- [ ] 18.9 Go live checklist and owner sign off

Gate: first real booking completes without manual fixes.

---
## PHASE 19. AFTER LAUNCH
---

- [ ] 19.1 After 20 to 30 jobs, review recommender weights
- [ ] 19.2 Review tier thresholds, deposit size and cancellation fees
- [ ] 19.3 Collect feedback and keep a weekly fix list
- [ ] 19.4 Plan the machine learning recommender (R15)
- [ ] 19.5 Update project-handoff.md and decision-log.md
- [ ] 19.6 Plan crew support: several workers on one job, each with check in, daily pay and chat access (Q34)
- [ ] 19.7 Review how often customers pick the best match, and how often picks decline

---
## OPEN QUESTIONS BY PHASE
---

The full text of each question lives in open-questions.md.

| Q | Needed by |
|---|---|
| 19 SMS provider | Phase 2 |
| 14 Tile provider and geocoder | Phase 4 |
| 20 ID and selfie retention | Phase 5 |
| 22 Launch areas and services | Phase 6 |
| 27 Reliability formula, 29 Urgent window | Phase 7 |
| 31 Urgent jobs, 32 to 34 Large jobs and foreman, 35 Declined pick | Phase 7 |
| 18 Deposit timing, 26 Deposit size | Phase 9 |
| 23 Day limits, 24 Extra work | Phase 10 and 11 |
| 21 Deposit when no provider is found | Phase 12 |
| 28 Holdback and provider pay | Phase 13 |
| 12 Lawyer, 13 Accountant | Phase 16 |
| 25 Hosting and domain | Phase 18 |