import {
  readBody,
  requireAdmin,
  UUID,
  databaseError,
} from "@/lib/matching/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifiedGatewayRefund, toCentavos } from "@/lib/payments/paymongo";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await readBody(request);
  if (
    !UUID.test(id) ||
    typeof body?.requestId !== "string" ||
    !UUID.test(body.requestId) ||
    typeof body?.reference !== "string"
  )
    return Response.json(
      { error: "Choose an approved refund and PayMongo refund reference." },
      { status: 400 },
    );
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { data: r } = await auth.session
    .from("booking_requests")
    .select("payment_id,amount,status")
    .eq("booking_id", id)
    .eq("id", body.requestId)
    .eq("kind", "refund")
    .maybeSingle();
  if (!r || r.status !== "approved")
    return Response.json(
      { error: "Refund approval is required first." },
      { status: 409 },
    );
  const { data: p } = await auth.session
    .from("payments")
    .select("paymongo_payment_id")
    .eq("id", r.payment_id)
    .eq("booking_id", id)
    .maybeSingle();
  if (!p?.paymongo_payment_id)
    return Response.json(
      { error: "Choose a gateway payment." },
      { status: 409 },
    );
  try {
    const remote = await verifiedGatewayRefund(
      body.reference,
      p.paymongo_payment_id,
      toCentavos(Number(r.amount)),
    );
    const { error } = await createAdminClient().rpc(
      "settle_verified_gateway_refund",
      {
        p_request: body.requestId,
        p_remote: remote.id,
        p_payment_remote: remote.paymentId,
        p_amount: remote.amount,
        p_actor: auth.user.id,
      },
    );
    if (error)
      return databaseError(error, "Could not record the verified refund.");
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      {
        error:
          "PayMongo has not confirmed a matching successful refund. Check its status, reference and amount.",
      },
      { status: 409 },
    );
  }
}
