
# Maz_Plumbing_and_General_Services
Send all files except project handoff to the AI before starting a project. Send the project handoff when you're close to the session limit.

## Run locally

- `npm run dev`: edit code with Fast Refresh. Pages compile when first opened, so cold navigation can take longer.
- `npm run preview`: build once, then serve the optimized application at `http://localhost:3000`. Use this when testing the admin, customer and provider flows without per-page compilation. Stop the existing server with Ctrl+C first.
- `npm start`: serve the latest successful build again without rebuilding. Code changes require another build or `npm run preview`.

Both modes use the same `.env.local` configuration and database. Preview is local testing; it does not publish or push changes.

## Experimental provider recommendations

The admin booking page automatically loads provider recommendations under **Team & schedule → Add workers**. Suggestions update as workers are selected, and selecting a suggestion fills the active worker row. Standard services fill the worker role automatically; renovation teams keep editable roles. The existing matching engine determines eligibility and remains the default and fallback. Workers receive offers only after the administrator submits the team.

See [ML service setup](ml-service/README.md) to run the Python service and enable the optional synthetic-trained LightGBM ranking. No database migration is required.

## Complete fictional test dataset

See [demo setup and testing](docs/DEMO_SEED_GUIDE.md) and the [active provider roster](docs/ACTIVE_PROVIDER_ROSTER.md). The development roster has exactly 56 active providers with multiple specializations. Run `npm run seed:demo` for a read-only consolidation plan, `npm run seed:demo -- --apply` to reconcile the demo roster, or `npm run seed:demo -- --verify` to verify it. Existing providers and historical bookings/payments are preserved. Retained demo accounts use the local `SEED_TEST_PASSWORD`; archived demo accounts cannot sign in.
