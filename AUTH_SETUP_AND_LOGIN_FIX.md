# MAZ login connectivity fix — local setup

## What caused the generic error?

The previous login page displayed "Could not reach the sign-in service" for **every** HTTP 503 response. In particular, the API returns 503 when `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing. This doesn't necessarily mean your internet is down. The downloadable ZIP deliberately excludes `.env.local` because it can contain private credentials. No code-only fix can authenticate actual users without a running Supabase project.

## Set up login on Windows / VS Code

1. Extract the *entire* ZIP. Open the folder that contains `package.json` in VS Code.
2. In the VS Code terminal run `Copy-Item .env.example .env.local` (PowerShell), or copy the file manually.
3. From **your** Supabase dashboard (https://supabase.com/dashboard), open the correct project and find **Project URL** and **publishable key / anon public key** in Project Settings > API / API Keys. Copy them into `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-REAL-PROJECT-REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-REAL-PUBLISHABLE-OR-ANON-KEY
   ```

   The above values are illustrative; do not leave the `YOUR-` examples in the file. Do not use a database password, personal access token, or `service_role` key in `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never post private keys in chat.
4. Run `npm install`, then `npm run auth:check`. This checks configuration and can try to contact the Supabase Auth endpoint without logging a user in.
5. Stop `npm run dev` (Ctrl+C), then restart with `npm run dev` to reload the environment variables. Open `http://localhost:3000/login`.
6. Sign in with an account *already created in this same Supabase project*. If the account does not exist, use **Sign up** first. If email confirmation is required, verify the email before login. Google sign-in needs its own Google provider configuration in Supabase.
7. For full app features, apply the database migrations in `supabase/migrations` to the same project and configure any separately required services. The public keys above alone are sufficient to reach the Supabase Auth API, not to bootstrap the whole database.

**Test interpretation:**
- "Login is not set up yet" → missing `.env.local` / missing values.
- "URL or API key is invalid" → malformed URL / example values / invalid public key.
- "Server cannot connect to Supabase" → network/DNS/TLS, project paused or unreachable.
- "Email or password is wrong" → service responded; check the account. The form does not reveal whether the email exists.
- "Confirm your email" → follow the verification link sent by Supabase.
- "Sign-in service is temporarily unavailable" → look in the `npm run dev` terminal, check project status, and run `npm run auth:check`.

## Files changed

Only authentication config, login error handling, auth session resilience, signup setup feedback, test coverage, the diagnostic script, and this documentation were updated. **No homepage, CSS, layout, or service design changes.** The location picker fix from the previous ZIP is retained.
