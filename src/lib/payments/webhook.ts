/** Pure helpers for the PayMongo webhook, kept apart so they can be tested without a server. */

export type PaymentOutcome = {
  paid: boolean;
  paymentId: string;
  paymongoPaymentId: string | null;
  method: "card" | "gcash" | "maya" | "grabpay" | "qrph" | null;
  reason: string | null;
};

const METHODS: Record<string, PaymentOutcome["method"]> = {
  card: "card", gcash: "gcash", paymaya: "maya", maya: "maya", grab_pay: "grabpay", qrph: "qrph",
};

/** Parses `t=...,te=...,li=...`. Test events carry `te`, live events carry `li`. */
export function signatureMatches(
  rawBody: string,
  header: string | null,
  secret: string,
  hmacHex: (data: string, key: string) => string,
  safeEqual: (a: Buffer, b: Buffer) => boolean,
): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));
  const timestamp = parts.t;
  if (!timestamp) return false;
  const expected = Buffer.from(hmacHex(`${timestamp}.${rawBody}`, secret));
  return [parts.te, parts.li].some((candidate) => {
    if (!candidate) return false;
    const given = Buffer.from(candidate);
    return given.length === expected.length && safeEqual(given, expected);
  });
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Turns a PayMongo event into what the database needs, or null for events we do not act on.
 * Handled: checkout_session.payment.paid, payment.paid, payment.failed.
 * The payment row id travels in the checkout metadata (`payment_id`).
 */
export function parseWebhookEvent(event: unknown): PaymentOutcome | null {
  const root = (event as Json)?.data?.attributes as Json | undefined;
  const type = root?.type as string | undefined;
  const resource = root?.data as Json | undefined;
  if (!type || !resource) return null;
  const attrs = (resource.attributes ?? {}) as Json;

  if (type === "checkout_session.payment.paid") {
    const paymentId = (attrs.metadata?.payment_id ?? attrs.reference_number) as string | undefined;
    const pay = (attrs.payments?.[0] ?? {}) as Json;
    if (!paymentId) return null;
    return {
      paid: true, paymentId,
      paymongoPaymentId: (pay.id as string | undefined) ?? null,
      method: METHODS[String(pay.attributes?.source?.type ?? attrs.payment_method_used ?? "")] ?? null,
      reason: null,
    };
  }
  if (type === "payment.paid" || type === "payment.failed") {
    const paymentId = attrs.metadata?.payment_id as string | undefined;
    if (!paymentId) return null;
    return {
      paid: type === "payment.paid", paymentId,
      paymongoPaymentId: (resource.id as string | undefined) ?? null,
      method: METHODS[String(attrs.source?.type ?? "")] ?? null,
      reason: type === "payment.failed" ? String(attrs.failed_message ?? attrs.failed_code ?? "Payment failed") : null,
    };
  }
  return null;
}
