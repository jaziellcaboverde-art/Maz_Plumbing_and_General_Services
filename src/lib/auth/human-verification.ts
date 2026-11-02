import { verifyRecaptcha } from "@/lib/auth/recaptcha";
import { verifyTurnstile } from "@/lib/auth/turnstile";

/**
 * Verify the configured anti-bot provider. reCAPTCHA is preferred for the
 * revised KumpuNinja UI; existing Cloudflare Turnstile deployments remain
 * supported so older environments and tests do not break.
 */
export async function verifyHumanChallenge(token: unknown, remoteIp?: string | null): Promise<boolean> {
  if (process.env.RECAPTCHA_SECRET_KEY) return verifyRecaptcha(token, remoteIp);
  if (process.env.TURNSTILE_SECRET_KEY) return verifyTurnstile(token, remoteIp);
  return true;
}

export function clientIp(headers: Headers): string | null {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}
