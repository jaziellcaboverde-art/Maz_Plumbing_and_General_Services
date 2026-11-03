import {
  readBody,
  requireAdmin,
  UUID,
  databaseError,
} from "@/lib/matching/http";
import { retrieveExpectedCheckout } from "@/lib/payments/reconcile";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = await readBody(request);
  if (
    typeof body?.paymentId !== "string" ||
    !UUID.test(body.paymentId) ||
    typeof body?.sessionId !== "string"
  )
    return Response.json(
      { error: "Choose the payment and its existing checkout ID." },
      { status: 400 },
    );
  const { data: p } = await auth.session
    .from("payments")
    .select(
      "id,amount,processing_fee,status,checkout_session_id,manual_channel",
    )
    .eq("id", body.paymentId)
    .maybeSingle();
  if (
    !p ||
    p.status !== "pending" ||
    p.manual_channel ||
    (p.checkout_session_id && p.checkout_session_id !== body.sessionId)
  )
    return Response.json(
      { error: "Select an unresolved matching gateway payment." },
      { status: 409 },
    );
  try {
    const remote = await retrieveExpectedCheckout(
        body.sessionId,
        p.id,
        Number(p.amount) + Number(p.processing_fee),
      ),
      admin = createAdminClient();
    if (remote.payment) {
      const { error: attach } = await admin
        .from("payments")
        .update({ checkout_session_id: body.sessionId })
        .eq("id", p.id)
        .eq("status", "pending");
      if (attach)
        return databaseError(attach, "Could not attach the verified checkout.");
      const method =
        (
          {
            card: "card",
            gcash: "gcash",
            paymaya: "maya",
            grab_pay: "grabpay",
            qrph: "qrph",
          } as Record<string, string>
        )[remote.payment.attributes.source?.type ?? ""] ?? null;
      const { error } = await admin.rpc("confirm_managed_gateway_payment", {
        p_payment: p.id,
        p_remote: remote.payment.id,
        p_amount: remote.payment.attributes.amount / 100,
        p_currency: remote.payment.attributes.currency,
        p_method: method,
      });
      if (error)
        return databaseError(error, "Could not settle the verified payment.");
      const { error: auditError } = await admin.rpc("write_audit", {
        p_actor: auth.user.id,
        p_action: "payment.reconciled_by_maz",
        p_target_table: "payments",
        p_target_id: p.id,
        p_reason: "Canonical paid checkout verified",
        p_details: { session: body.sessionId },
      });
      if (auditError)
        return databaseError(
          auditError,
          "Payment verified; audit reconciliation needs attention.",
        );
    } else {
      const { error } = await admin.rpc("reconcile_managed_checkout", {
        p_payment: p.id,
        p_session: body.sessionId,
        p_url: remote.url,
        p_state: remote.status,
        p_actor: auth.user.id,
      });
      if (error)
        return databaseError(error, "Could not reconcile the checkout.");
    }
    return Response.json({ ok: true, state: remote.status });
  } catch {
    return Response.json(
      {
        error:
          "The gateway checkout could not be matched or verified. Check its ID in PayMongo and contact gateway support if unresolved.",
      },
      { status: 409 },
    );
  }
}
