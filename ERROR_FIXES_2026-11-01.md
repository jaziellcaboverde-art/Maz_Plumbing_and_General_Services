# KumpuNinja error-fix pass — 2026-11-01

This patch follows the revised KumpuNinja UI/UX information architecture while fixing the errors reported after the first UI pass.

## Fixed

1. **Chat TypeScript union errors**
   - `load-inbox.ts` now types the combined booking/support conversation array as `ChatConversation[]`.
   - Removed an impossible `selected.type === "support"` check inside the already booking-only details branch.

2. **RoleNav TypeScript test errors**
   - `identityName` and `identityRole` are now optional when `RoleNav` is rendered directly.
   - The application shell can still provide the real signed-in identity; direct component tests receive safe display defaults.

3. **CAPTCHA compatibility**
   - Added a `HumanVerificationWidget` and server-side `verifyHumanChallenge` adapter.
   - Google reCAPTCHA v2 remains the preferred revised UI option.
   - Existing Cloudflare Turnstile configuration remains supported as a fallback.
   - If reCAPTCHA is configured, it is used. Otherwise, if Turnstile is configured, Turnstile is used. If neither is configured, CAPTCHA is disabled for local development.
   - This restores the existing signup-route test expectation when `TURNSTILE_SECRET_KEY` is enabled.

4. **Navigation tests updated to the revised IA**
   - Tests now expect Dashboard / Book service / My bookings / Notifications for customers.
   - Tests now expect Dashboard / Assignments / Schedule / Notifications for providers.
   - Tests now expect Dashboard / Bookings / Assignments / Notifications for admin.
   - All three roles are allowed a mobile More page for lower-frequency tools.

5. **Vitest worker timeout mitigation**
   - Changed the test pool from the default child-process `forks` behavior to `vmThreads`.
   - Limited test concurrency to 2 workers to reduce Windows worker-start pressure and jsdom memory contention.

6. **Font warning**
   - Replaced `Atkinson Hyperlegible Next` in `next/font` with `Inter` to avoid the Turbopack fallback-metric warning while retaining a clean accessible sans-serif interface.

## Environment notes

For CAPTCHA, configure only the provider you intend to use:

### Preferred: Google reCAPTCHA v2

```
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=...
RECAPTCHA_SECRET_KEY=...
```

### Alternate/fallback: Cloudflare Turnstile

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
```

Do not commit `.env.local`.

## Recommended validation commands

```
npm run typecheck
npm test
npm run build
```

The current lockfile's jsdom dependency declares a Node requirement of 22.22.2+ (or compatible newer release), so upgrading Node can help avoid test-runner/environment issues on older Node 22 patch releases.
