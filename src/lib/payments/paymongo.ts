import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { parseWebhookEvent, signatureMatches, type PaymentOutcome } from "./webhook";

export { parseWebhookEvent, signatureMatches };
export type { PaymentOutcome };

/** Test mode: no PayMongo secret key is set, so the pay page shows buttons that pretend to be the bank. */
export function paymongoConfigured(): boolean {
  return Boolean(process.env.PAYMONGO_SECRET_KEY?.trim());
}

export function toCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

export const PAYMENT_METHOD_TYPES = ["card", "gcash", "paymaya", "grab_pay", "qrph"] as const;

type CheckoutInput = { paymentId: string; bookingId: string; amount: number; description: string; origin: string };

/**
 * Creates a PayMongo Checkout Session and returns the page the customer pays on.
 * PayMongo handles 3DS, e-wallet approval and the QR Ph code on that page.
 */
export async function createCheckout(input: CheckoutInput): Promise<{ id: string; url: string }> {
  const secret = process.env.PAYMONGO_SECRET_KEY?.trim();
  if (!secret) throw new Error("PAYMONGO_SECRET_KEY is not set");
  const back = `${input.origin}/customer/bookings/${input.bookingId}`;
  const response = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [{ currency: "PHP", amount: toCentavos(input.amount), name: input.description, quantity: 1 }],
          payment_method_types: PAYMENT_METHOD_TYPES,
          description: input.description,
          reference_number: input.paymentId,
          metadata: { payment_id: input.paymentId, booking_id: input.bookingId },
          success_url: `${back}?payment=return`,
          cancel_url: `${back}?payment=cancelled`,
          send_email_receipt: false,
          show_description: true,
        },
      },
    }),
  });
  const json = (await response.json().catch(() => null)) as
    | { data?: { id?: string; attributes?: { checkout_url?: string } } }
    | null;
  const url = json?.data?.attributes?.checkout_url;
  if (!response.ok || !json?.data?.id || !url) throw new Error(`PayMongo refused the checkout (${response.status})`);
  return { id: json.data.id, url };
}

/** Checks the `Paymongo-Signature` header: HMAC-SHA256 of `${t}.${rawBody}` with the webhook secret. */
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  return signatureMatches(rawBody, header, secret, (data, key) => createHmac("sha256", key).update(data).digest("hex"), timingSafeEqual);
}
