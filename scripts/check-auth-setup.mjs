/** Safe local auth diagnostics. Prints no tokens/passwords and never signs anyone in. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const filename = join(process.cwd(), '.env.local');
const values = { ...process.env };
if (existsSync(filename)) {
  for (const line of readFileSync(filename, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const raw = match[2].trim();
    const cleaned = /^(['"])(.*)\1$/.exec(raw)?.[2] ?? raw.replace(/\s+#.*$/, '');
    // File overrides inherited environment the same way the local Next.js setup is expected to.
    values[match[1]] = cleaned;
  }
} else {
  console.error('Missing .env.local in the project root (same folder as package.json).');
  console.error('Copy .env.example to .env.local and fill in your own Supabase Project URL and publishable/anon key.');
  process.exitCode = 1;
}

const url = (values.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
const key = (values.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  console.error('Find these in Supabase Dashboard > Project Settings > API / API Keys. Do not use the service_role key as the public key.');
  process.exit(1);
}
if (/^(YOUR[_ -]|PASTE[_ -]|REPLACE[_ -]|<)/i.test(url) || /^(YOUR[_ -]|PASTE[_ -]|REPLACE[_ -]|<)/i.test(key)) {
  console.error('Your .env.local still contains example placeholder values. Replace them with actual Supabase settings.');
  process.exit(1);
}
let parsed;
try {
  parsed = new URL(url);
  const local = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (!['https:', ...(local ? ['http:'] : [])].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) throw Error();
} catch {
  console.error('Invalid NEXT_PUBLIC_SUPABASE_URL. Use the project base URL (for example https://project-ref.supabase.co), not a dashboard, API path, or SQL URL.');
  process.exit(1);
}
console.log('Supabase configuration: both public settings are present and the URL format looks valid.');
console.log('Checking whether the Supabase Auth endpoint is reachable (no credentials will be printed)...');
try {
  const response = await fetch(`${parsed.origin}/auth/v1/health`, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(8000),
    redirect: 'error',
  });
  if (response.ok) {
    console.log('Auth endpoint reachable. Try logging in with an existing account (and confirm the email if required).');
    console.log('This reachability check does not prove that an account exists or that the API key is accepted for sign-in.');
  } else {
    console.error(`Auth endpoint responded with HTTP ${response.status}. Check the project URL, public API key, and project status in Supabase.`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Cannot connect to Supabase Auth (${error?.name === 'TimeoutError' ? 'timed out' : 'network/DNS/TLS failure'}).`);
  console.error('Check internet, firewall/VPN, whether the Supabase project is active, and the Project URL.');
  process.exitCode = 1;
}
