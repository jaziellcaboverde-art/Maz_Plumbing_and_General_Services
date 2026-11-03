# KumpuNinja UI/UX Revision Notes

This revision applies the KumpuNinja Detailed System Design and UI/UX Specification to the existing Next.js project without deleting legacy working routes.

## Applied
- Updated shared color system toward the KumpuNinja navy/service-blue palette.
- Simplified and modernized the responsive sidebar and mobile tab navigation.
- Reorganized Customer, Provider, and Admin navigation around role tasks.
- Added Customer shortcuts for Book Service and Service History while preserving existing booking routes.
- Reworked the Admin home screen into an operational dashboard with request, urgent, assignment, and payment-review summaries plus quick actions.
- Corrected public wording so the main flow reflects MAZ review/assignment, quotation approval, and payment recording rather than claiming customer-controlled assignment or in-system payment.
- Added Google reCAPTCHA v2 support to login and customer/provider sign-up. It is enabled only when the reCAPTCHA environment keys are configured.
- Preserved loading/error/empty-state patterns and existing notification, modal, booking-status, accessibility, and responsive components.
- Sanitized `.env.example`. The deliverable intentionally excludes `.env.local`.

## Important backend follow-up
Legacy marketplace code still contains customer provider-picking and public provider-application flows. Those routes were not deleted in this UI-only pass so working behavior is not lost. They should be reconciled with the final Chapter 1-2 business rules in a dedicated backend/database refactor after regression tests are available.

## reCAPTCHA setup
Set these in `.env.local`:
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
- `RECAPTCHA_SECRET_KEY`

If they are blank, authentication continues without the reCAPTCHA widget for local development.

## Validation limitation
The source archive did not include `node_modules`. Dependency installation could not finish in the execution environment, so a full Next.js build/test run could not be completed here. Static inspection was performed, and existing token-check failures were found throughout legacy files that predate this revision.
