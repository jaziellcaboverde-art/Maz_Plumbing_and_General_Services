# Provider application — location fix

This ZIP is based on the latest **(2) HOMEPAGE_REDESIGN_FIXED** project. The homepage and other pages have not been redesigned or changed.

## Fixed

The provider application allows visitors to choose a base location before creating an account. Previously, the location picker and the public geocoding API attempted to use Supabase even when no Supabase environment variables existed, producing: `Supabase is not set up yet...`. Public location lookups now work without a Supabase session, using the existing per-IP guest lookup limit.

## Required configuration

From the same directory as `package.json`, copy `.env.example` to `.env.local` and fill in your real project keys (never share or commit service-role keys):

```powershell
Copy-Item .env.example .env.local
```

```dotenv
# Required for maps and address search:
GEOAPIFY_API_KEY=YOUR_GEOAPIFY_KEY
NEXT_PUBLIC_GEOAPIFY_API_KEY=YOUR_GEOAPIFY_KEY

# Required for signup, login, and submitting provider applications:
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Geoapify: obtain a key from https://myprojects.geoapify.com/ . Supabase: Project Settings > API Keys / API settings for your project URL and keys. `NEXT_PUBLIC_` values are visible in the browser. **Never** put the Supabase service-role key in a `NEXT_PUBLIC_` variable.

Then stop the running dev server and restart:

```powershell
npm install
npm run dev
```

`http://localhost:3000` is sufficient for browser geolocation while developing; other origins generally require HTTPS. Allow location access in the browser.

**Important:** This change removes an unnecessary dependency from *choosing* a location. It does not replace or bypass Supabase for account creation, protected user data, or submitting a provider application, and does not provide Geoapify API credentials. Without Geoapify the map/search will show a configuration prompt rather than work.
