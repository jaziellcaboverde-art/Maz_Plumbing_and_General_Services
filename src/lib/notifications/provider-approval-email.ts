import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendBrevoEmail } from "./brevo-email";
import { renderNotificationEmail } from "./email-template";

/** Send an approval message with a one-time link for setting a password. */
export async function sendProviderApprovalEmail(profileId: string, reviewedAt: string): Promise<void> {
  const admin = createAdminClient();
  const { data: userResult, error: userError } = await admin.auth.admin.getUserById(profileId);
  if (userError) throw new Error(`Could not find the approved provider's email: ${userError.message}`);
  const email = userResult.user?.email;
  if (!email) throw new Error("The approved provider account has no email address.");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const redirectTo = new URL("/auth/confirm?next=%2Freset-password", siteUrl).toString();
  const { data: linkResult, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });
  if (linkError) throw new Error(`Could not create the provider password setup link: ${linkError.message}`);
  const actionUrl = linkResult.properties?.action_link;
  if (!actionUrl) throw new Error("Supabase did not return a provider password setup link.");

  const title = "Your provider application has been approved";
  const body = "Your provider account is active. Use the secure link below to set your password, then log in to open your provider dashboard. For your security, we never send passwords by email.";
  const content = renderNotificationEmail({ title, body, actionUrl });
  await sendBrevoEmail({
    to: email,
    subject: title,
    html: content.html,
    text: content.text,
    idempotencyKey: `provider-approval-${profileId}-${reviewedAt}`,
  });
}
