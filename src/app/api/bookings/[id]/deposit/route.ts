import { databaseError, requireUser, UUID } from "@/lib/matching/http";
import { createCheckout, paymongoConfigured } from "@/lib/payments/paymongo";
import { createAdminClient } from "@/lib/supabase/admin";

/** The customer presses "Pay deposit". Returns the page to pay on (PayMongo, or the test page when no keys are set). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Booking not found." }, { status: 404 });
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.session.rpc("start_deposit_payment", { p_booking_id: id });
  if (error) return databaseError(error, "Could not start the payment. Try again.");
  const { payment_id: paymentId, amount } = data as { payment_id: string; amount: number };

  if (!paymongoConfigured()) return Response.json({ ok: true, url: `/customer/pay/${paymentId}`, testMode: true });

  try {
    const checkout = await createCheckout({
      paymentId, bookingId: id, amount: Number(amount), description: "MAZ Plumbing deposit", origin: new URL(request.url).origin,
    });
    await createAdminClient().from("payments").update({ checkout_session_id: checkout.id }).eq("id", paymentId);
    return Response.json({ ok: true, url: checkout.url, testMode: false });
  } catch (cause) {
    console.error("PayMongo checkout failed", cause);
    return Response.json({ error: "The payment page could not open. No money was taken. Try again in a moment." }, { status: 502 });
  }
}

