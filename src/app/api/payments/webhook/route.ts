import {
  verifySignature,
  verifiedCheckoutPayment,
  toCentavos,
} from "@/lib/payments/paymongo";
import { parseWebhookEvent } from "@/lib/payments/webhook";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(request: Request) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET?.trim();
  if (!secret)
    return Response.json(
      { error: "Webhook is not configured." },
      { status: 503 },
    );
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("paymongo-signature"), secret))
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid event." }, { status: 400 });
  }
  const outcome = parseWebhookEvent(event);
  if (!outcome) return Response.json({ ok: true, ignored: true });
  // Failed attempts do not settle a payment or authorize work. The active checkout may be retried.
  if (!outcome.paid) return Response.json({ ok: true, settled: false });
  const admin = createAdminClient();
  const { data: p, error } = await admin
    .from("payments")
    .select("id,booking_id,amount,processing_fee,checkout_session_id,status")
    .eq("id", outcome.paymentId)
    .maybeSingle();
  if (error || !p || !p.checkout_session_id)
    return Response.json(
      { error: "Expected checkout record not available." },
      { status: 409 },
    );
  try {
    const paid = await verifiedCheckoutPayment(
      p.checkout_session_id,
      p.id,
      toCentavos(Number(p.amount) + Number(p.processing_fee)),
    );
    const method =
      (
        {
          card: "card",
          gcash: "gcash",
          paymaya: "maya",
          maya: "maya",
          grab_pay: "grabpay",
          qrph: "qrph",
        } as Record<string, string>
      )[paid.attributes.source?.type ?? ""] ?? null;
    const { error: settleError } = await admin.rpc(
      "confirm_managed_gateway_payment",
      {
        p_payment: p.id,
        p_remote: paid.id,
        p_amount: paid.attributes.amount / 100,
        p_currency: paid.attributes.currency,
        p_method: method,
      },
    );
    if (settleError) throw settleError;
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Gateway verification did not match this expected payment." },
      { status: 409 },
    );
  }
}
