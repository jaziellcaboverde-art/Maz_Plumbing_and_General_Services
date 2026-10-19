# Supabase setup (Phase 2, steps 2.1 and 2.3)

Do these in order. Commands are for the VS Code terminal opened in the project folder.

## 1. Project (step 2.1)
The target project has been created: `capstone-phase-2`, region Southeast Asia (Singapore), project ref `nymacomxxhzhowsxcpsb`. Its dashboard currently shows no migrations. Keep its database password available for the link step.

## 2. Copy the keys into .env.local
In the dashboard, use **Settings > API Keys** (or the **Connect** dialog) for `capstone-phase-2`. Copy the `sb_publishable_...` key into `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the `sb_secret_...` key into `SUPABASE_SERVICE_ROLE_KEY`. These variable names are kept for compatibility with the app. The publishable key may be used in browser code; the secret key must stay server-side.

    NEXT_PUBLIC_SUPABASE_URL=       Project URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY=  sb_publishable_... (safe for the browser; variable name retained by the app)
    SUPABASE_SERVICE_ROLE_KEY=      sb_secret_... (server only; never share it or commit it)
    SEED_TEST_PASSWORD=             any password you choose, 8 or more characters (test users only)

Add the SEED_TEST_PASSWORD line yourself. It is not in .env.example yet.

## 3. Link the project and apply the database files (step 2.3)

Before pushing, the owner must confirm Q37 because the migrations include the proposed booking status rules.

    npx.cmd supabase link --project-ref nymacomxxhzhowsxcpsb
    npx.cmd supabase db push --dry-run
    npx.cmd supabase db push
    npx.cmd supabase migration list --linked

- In PowerShell, use the `.cmd` commands above so execution policy does not block `npx.ps1`.
- If the CLI is not logged in yet, run `npx.cmd supabase login` first.
- The project ref is the code in the project URL: `https://nymacomxxhzhowsxcpsb.supabase.co`.
- link and db push ask for the database password from step 1. Confirm the dry run lists the project's pending migrations before running `db push`.
- db push applies all pending files in supabase/migrations in order. This is also step 2.21 on an empty database.
- If one file fails, stop and send me the full error text. Do not edit the database by hand.

## 4. Add test data and run the access check (steps 2.19 and 2.20)

    npm.cmd run seed:test
    npm.cmd run check:rls

Every line of check:rls should say PASS. Send me any FAIL line.

## 5. Auth settings (Dashboard, Authentication)
- URL Configuration: Site URL = http://localhost:3000
- Redirect URLs: include http://localhost:3000/**
- Leave the default confirmation and recovery email templates unchanged. New free-tier projects using Supabase's default email sender cannot edit these templates. The app's auth callback accepts the PKCE code used by the default template; password reset requests redirect to /reset-password after verification.
- Email provider: leave email confirmation on.

## 6. Customer auth email before launch (step 2.16, open question 38)
For development, keep Supabase's built-in sender. It only sends to organization team addresses and is limited to 2 emails per hour. Before sending authentication emails to customers, configure custom SMTP with a verified sender domain. If using Resend, in Supabase Authentication SMTP settings:
- Host smtp.resend.com, port 465, username resend, password = your Resend API key
- Sender email: an address on a domain you verified in Resend

## 7. App notification email (Phase 3)
The app sends transaction notifications through the Resend API, separately from Supabase Auth email. Add these server-only settings to `.env.local` after a Resend sender is available:

    RESEND_API_KEY=
    NOTIFICATION_FROM_EMAIL=
    NOTIFICATION_REPLY_TO_EMAIL=
    NOTIFICATION_WORKER_SECRET=  a private random value used to protect the retry endpoint
    NOTIFICATION_WORKER_URL=http://localhost:3000

Use addresses on a domain verified in Resend for real delivery. Do not add these values to browser code or share the API key.

The Phase 3 retry worker sends due notification deliveries and alerts all admin accounts once after three failed attempts. For development, keep `npm.cmd run dev` running in one terminal and run `npm.cmd run notify:retry` in another. The worker retries failed deliveries after five minutes. `NOTIFICATION_WORKER_SECRET` must be a long random value and kept private. A scheduled host worker is a later deployment task (Q40).

To send one manual Phase 3.8 test notification to an existing app account, keep the development server running and run `npm.cmd run notify:test -- your-account-email@example.com` in another terminal. It queues an email and in-app alert, runs the worker, and prints each channel's status. The address must already have an MAZ Plumbing and General Services profile. With Resend's development sender, use the same address as the Resend account owner; a verified sender domain is needed to test delivery to other addresses.

## 8. Phone OTP (step 2.17)
The owner deferred phone OTP and paid SMS until a budget is available (decision-log.md #17). Do not configure Twilio or register a sender ID now.
