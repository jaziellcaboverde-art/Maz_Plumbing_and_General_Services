# MAZ Plumbing and General Services — updated (2) project

This is the complete SOURCE project from **Maz_Plumbing_and_General_Services-main (2).zip** (the newer version). It retains the newer provider application and booking features. The original, older ZIP was used only to compare the public homepage design.

## Changes made

- Kept the homepage and public brand markup and styles matching the older version; these already matched in the supplied source.
- Fixed the public shell so the MAZ logo, navigation, Log in / Sign up buttons, and full contact/legal footer **stay visible** on **/login**, **/signup** and **/apply/provider**, including the provider application's submitted view.
- Retained the newer provider application steps while ensuring the left step list doesn't cover the sticky public header.
- Removed a duplicate `main` landmark in the provider application.
- Added `tests/public-header-footer.test.tsx` to prevent this layout regression.

## Run on Windows (PowerShell)

1. Extract the ZIP, then open PowerShell **in the extracted folder that contains `package.json`** (not its parent folder).
2. Run `npm install` or `npm ci` to install dependencies.
3. If needed, copy `.env.example` to `.env.local` and provide the actual settings for your Supabase project and other integrations. Never publish real secrets.
4. Run `npm run dev`, then open `http://localhost:3000`.
5. Check the logo/navbar/footer on the homepage and on `/login`, `/signup`, `/apply/provider`.

You can verify you're in the right directory by running `dir package.json` before `npm run dev`. Do not run npm from the outer ZIP-extraction directory if it does not have `package.json`.

## Validation notes

The ZIP was checked for file integrity and the updated TSX was syntax-parsed. Browser-level tests could not be executed in the packaging environment: the dependencies in the older archive are Windows-specific, and package downloads were unavailable here. `npm run check:tokens` also reports 10 existing raw-token style warnings in the unrelated admin provider-schedules CSS.


## Homepage design update — screenshot reference

The newer **(2)** project now uses the attached screenshot as the guest homepage visual reference: full-width pale blue hero, large logo with line-art rings and service chips, two CTAs, trust badges, connected four-step process, three-column catalog cards, prominent 24/7 emergency service styling, and a navy/gold why-book section and coordinated footer. The public header and footer remain visible on login/signup/provider application. Services still come from `loadPublicServices()` (with seeded fallback); no booking or provider logic was replaced.
