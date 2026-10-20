import "server-only";

import { createHash } from "node:crypto";

type BrevoEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
};

function makeIdempotencyUuid(key: string): string {
  const characters = createHash("sha256").update(key).digest("hex").slice(0, 32).split("");
  characters[12] = "5";
  characters[16] = ((Number.parseInt(characters[16], 16) & 0x3) | 0x8).toString(16);
  const hex = characters.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Sends transactional email through Brevo. Keep this module server-only. */
export async function sendBrevoEmail({ to, subject, html, text, idempotencyKey }: BrevoEmail): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  const replyTo = process.env.NOTIFICATION_REPLY_TO_EMAIL;
  if (!apiKey || !from || !replyTo) {
    throw new Error("Email delivery needs BREVO_API_KEY, NOTIFICATION_FROM_EMAIL, and NOTIFICATION_REPLY_TO_EMAIL.");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: process.env.NOTIFICATION_FROM_NAME ?? "MAZ Plumbing and General Services", email: from },
      to: [{ email: to }],
      replyTo: { email: replyTo },
      subject,
      htmlContent: html,
      textContent: text,
      ...(idempotencyKey ? { headers: { idempotencyKey: makeIdempotencyUuid(idempotencyKey) } } : {}),
    }),
  });

  if (!response.ok) {
    const responseBody: unknown = await response.json().catch(() => null);
    const message = responseBody && typeof responseBody === "object" && "message" in responseBody
      ? String(responseBody.message)
      : `Brevo returned HTTP ${response.status}.`;
    throw new Error(`Email delivery failed: ${message}`);
  }
}
