
# Maz_Plumbing_and_General_Services
Send all files except project handoff to the AI before starting a project. Send the project handoff when you're close to the session limit.

## Run locally

- `npm run dev`: edit code with Fast Refresh. Pages compile when first opened, so cold navigation can take longer.
- `npm run preview`: build once, then serve the optimized application at `http://localhost:3000`. Use this when testing the admin, customer and provider flows without per-page compilation. Stop the existing server with Ctrl+C first.
- `npm start`: serve the latest successful build again without rebuilding. Code changes require another build or `npm run preview`.

Both modes use the same `.env.local` configuration and database. Preview is local testing; it does not publish or push changes.
