import { deliverNotifications } from "@/lib/matching/engine";
import { parseWebhookEvent, verifySignature } from "@/lib/payments/paymongo";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PayMongo calls this when a payment succeeds or fails (steps 9.11 and 9.16).
 * 1. The signature must match the raw body. Anything else is refused.
 * 2. The database function ignores a repeat, so PayMongo retrying never changes the booking twice.
 * Events we do not act on are answered with 200 so PayMongo stops retrying them.
 */
export async function POST(request: Request) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET?.trim();
  if (!secret) return Response.json({ error: "Webhook secret is not set." }, { status: 503 });
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("paymongo-signature"), secret)) {
    return Response.json({ error: "Bad signature." }, { status: 401 });
  }
  let event: unknown;
  try { event = JSON.parse(raw); } catch { return Response.json({ error: "Bad body." }, { status: 400 }); }
  const outcome = parseWebhookEvent(event);
  if (!outcome) return Response.json({ ok: true, ignored: true });

  const { data, error } = await createAdminClient().rpc("apply_payment_result", {
    p_payment_id: outcome.paymentId, p_paid: outcome.paid, p_method: outcome.method,
    p_paymongo_payment_id: outcome.paymongoPaymentId, p_reason: outcome.reason,
  });
  if (error) {
    console.error("apply_payment_result failed", error.message);
    // 500 makes PayMongo retry. A payment id we do not know will not get better, so that one is a 200.
    return Response.json({ error: "Could not save." }, { status: error.code === "P0002" ? 200 : 500 });
  }
  await deliverNotifications((data as { notify?: unknown } | null)?.notify);
  return Response.json({ ok: true, changed: (data as { changed?: boolean } | null)?.changed ?? false });
}
