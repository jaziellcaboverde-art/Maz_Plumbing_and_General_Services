import { deliverNotifications } from "@/lib/matching/engine";
import { databaseError, readBody, requireUser, UUID } from "@/lib/matching/http";
import { paymongoConfigured } from "@/lib/payments/paymongo";
import { createAdminClient } from "@/lib/supabase/admin";

/** Test mode only: the customer pretends the bank said yes or no. Switched off once PayMongo keys exist. */
export async function POST(request: Request) {
  if (paymongoConfigured()) return Response.json({ error: "Test payments are off." }, { status: 404 });
  const body = await readBody(request);
  const paymentId = typeof body?.paymentId === "string" ? body.paymentId : "";
  if (!UUID.test(paymentId) || (body?.outcome !== "paid" && body?.outcome !== "failed")) {
    return Response.json({ error: "Choose pay or decline." }, { status: 400 });
  }
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  // The customer can only see their own payments (row level security).
  const { data: own } = await auth.session.from("payments").select("id,booking_id").eq("id", paymentId).maybeSingle();
  if (!own) return Response.json({ error: "Payment not found." }, { status: 404 });

  const { data, error } = await createAdminClient().rpc("apply_payment_result", {
    p_payment_id: paymentId, p_paid: body.outcome === "paid", p_method: "card",
    p_paymongo_payment_id: null, p_reason: body.outcome === "failed" ? "Test payment declined" : null,
  });
  if (error) return databaseError(error, "Could not save the test payment.");
  await deliverNotifications((data as { notify?: unknown } | null)?.notify);
  return Response.json({ ok: true, bookingId: (own as { booking_id: string }).booking_id });
}
