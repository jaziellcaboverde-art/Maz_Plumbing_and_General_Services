# CAPTCHA and independent scrolling

## Google reCAPTCHA v2 checkbox setup
1. Create a **reCAPTCHA v2 Checkbox** key pair in the Google reCAPTCHA console. Add `localhost` and your deployed hostname as authorized domains.
2. In `.env.local` set BOTH `NEXT_PUBLIC_RECAPTCHA_SITE_KEY=...` and `RECAPTCHA_SECRET_KEY=...`. Do not commit or share secrets.
3. Remove/comment any `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` entries if switching to Google reCAPTCHA.
4. Restart `npm run dev` after changing environment variables. The browser's public key is embedded at build time.
5. Verify the checkbox appears on Login and Signup. If not, inspect browser console/network for blocked `google.com/recaptcha/api.js`, and check your authorized domains.
6. For deployment, set the same variables in the hosting platform and rebuild.

The UI cannot generate real site keys. If the secret is configured without the matching public key, sign-in will fail: configure both keys together.

## Layout
- Login and Signup cards scroll independently of the public header and branded panel.
- On desktop dashboards, sidebar and content each have their own scroll container.
- On small screens, navigation stays in the existing mobile layout.
