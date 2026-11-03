import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { workflowSession } from "@/lib/workflow/session";
export default function Page({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  return (
    <Suspense fallback={<p role="status">Loading booking payment?</p>}>
      <Payment params={params} />
    </Suspense>
  );
}
async function Payment({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) notFound();
  const { client } = await workflowSession("customer");
  const { data, error } = await client
    .from("payments")
    .select("booking_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (error)
    return <p role="alert">Could not load your payment. Please refresh.</p>;
  if (!data) notFound();
  return redirect(`/customer/bookings/${data.booking_id}`);
}
