# project-brief.md

---
## AI RULES — READ FULLY BEFORE ANY ACTION
---

1. Read this entire file first. If any section is blank → stop and ask.
2. Automate before building UI. Only surface controls when human judgment is required.
3. Uncertain mid-build → pause, state why, offer two directions, wait for input.
4. All decisions must serve the intent defined below. Flag conflicts, never override silently.
5. Before touching anything → map all connected files and dependencies first.
6. At each major milestone — before, not after — confirm direction with the human before continuing.

---
## PROJECT REFERENCE
---

**Project Name:** MAZ Plumbing and General Services

**The Problem:**
Customers who need home services (repairs, installations, renovations) have no reliable way to find a trusted nearby provider, agree on a fair price, and pay safely. Providers have no steady way to receive jobs and get paid correctly.

**The Goal:**
A booking platform that recommends the best nearby approved providers, lets the customer pick one (admin assigns a foreman on large jobs), holds a deposit through the system, tracks the job to a signed completion, and pays the provider fairly.

**Who It's For:**
- Customers: households and small businesses in the Philippines booking home services.
- Providers: independent workers paid a fixed daily rate plus reimbursed materials.
- Admin: the owner's team, who handle approvals, exceptions, cash records and payouts.

**Automation Expectations:**
Automatic: ranking providers for the customer, offers to the picked provider and offer timeouts (3 misses, then the admin queue), the automatic chain on urgent jobs, payment tier selection, deposit and refund handling, arrival check within 200 m, reminders.
Needs a human: customer choice of provider on normal jobs, foreman assignment on large jobs, provider approval, quote and class approval, cash recording, GPS and signature overrides, disputes, major cancellation fees, payouts that fail.

**What Done Looks Like:**
A first real booking completes from request to signed Done, balance paid, provider paid and review left, with no manual fixes. All phase gates pass and the owner signs off.

**What This Is NOT:**
- Providers never collect customer cash.
- No machine learning recommender at launch (planned for after launch).
- No payments outside the rules in the Locked Decisions table.

**Open Questions Before Starting:**
Q10 (vector logo, placeholder allowed) and Q11 (PayMongo test account, to be created). Questions 18 to 25 are tagged to later phases.
