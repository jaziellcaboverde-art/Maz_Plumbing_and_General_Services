import { notFound, redirect } from "next/navigation";
import { PageHeading } from "@/components/layout/page-heading";
import { TestPayment } from "@/components/payments/test-payment";
import { paymongoConfigured } from "@/lib/payments/paymongo";
import { formatPeso } from "@/lib/quotes/rules";
import { createClient } from "@/lib/supabase/server";
import quoteStyles from "@/components/quotes/quotes.module.css";

/** Test payment page. Real payments happen on PayMongo's page, so this only opens while no keys are set. */
export default async function TestPaymentPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(paymentId) || paymongoConfigured()) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: payment } = await supabase.from("payments").select("id,booking_id,amount,status").eq("id", paymentId).maybeSingle();
  if (!payment) notFound();
  if (payment.status !== "pending") redirect(`/customer/bookings/${payment.booking_id}`);
  return (
    <section className={quoteStyles.stack}>
      <PageHeading title="Test payment" description="No real money moves. This page stands in for PayMongo until the test keys are added." />
      <div className={quoteStyles.card}>
        <div className={quoteStyles.head}><span className={quoteStyles.title}>Deposit</span><span className={quoteStyles.amount}>{formatPeso(Number(payment.amount))}</span></div>
        <TestPayment paymentId={payment.id} bookingId={payment.booking_id} />
      </div>
    </section>
  );
}
