import {
  readBody,
  requireUser,
  databaseError,
  UUID,
} from "@/lib/matching/http";
import { createCheckout, paymongoConfigured } from "@/lib/payments/paymongo";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await readBody(request);
  if (
    !UUID.test(id) ||
    !["inspection", "deposit", "milestone", "balance"].includes(
      String(body?.purpose),
    ) ||
    body?.feeAccepted !== true
  )
    return Response.json(
      { error: "Review the payable amount and processing fee first." },
      { status: 400 },
    );
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!paymongoConfigured())
    return Response.json(
      {
        error:
          "Online checkout is not configured. Use a MAZ-verified manual channel.",
      },
      { status: 503 },
    );
  const { data: payment, error } = await auth.session.rpc(
    "start_managed_payment",
    { p_booking: id, p_purpose: body.purpose, p_fee_accepted: true },
  );
  if (error) return databaseError(error, "Could not prepare your payment.");
  const p = payment as {
    id: string;
    amount: number;
    processing_fee: number;
    gateway_checkout_url: string | null;
  };
  if (p.gateway_checkout_url)
    return Response.json({ url: p.gateway_checkout_url });
  const admin = createAdminClient();
  const { data: claim, error: claimError } = await admin
    .from("payments")
    .update({ gateway_checkout_claimed_at: new Date().toISOString() })
    .eq("id", p.id)
    .eq("status", "pending")
    .is("gateway_checkout_claimed_at", null)
    .select("id")
    .maybeSingle();
  if (claimError || !claim)
    return Response.json(
      {
        error:
          "This payment already has a checkout being prepared. Refresh shortly; contact MAZ if it remains pending.",
      },
      { status: 409 },
    );
  try {
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const checkout = await createCheckout({
      paymentId: p.id,
      bookingId: id,
      amount: Number(p.amount),
      processingFee: Number(p.processing_fee),
      description: `MAZ ${body.purpose} payment`,
      origin,
    });
    const { error: saveError } = await admin
      .from("payments")
      .update({
        checkout_session_id: checkout.id,
        gateway_checkout_url: checkout.url,
      })
      .eq("id", p.id);
    if (saveError) throw saveError;
    return Response.json({ url: checkout.url });
  } catch {
    return Response.json(
      {
        error:
          "Checkout could not be confirmed. MAZ will reconcile this attempt before creating another charge.",
      },
      { status: 502 },
    );
  }
}
