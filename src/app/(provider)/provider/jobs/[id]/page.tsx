import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PageHeading } from "@/components/layout/page-heading";
import { InspectionForm } from "@/components/quotes/inspection-form";
import { QuoteForm } from "@/components/quotes/quote-form";
import { dayAndTime } from "@/lib/matching/format";
import { STATUS_LABELS, type BookingStatus } from "@/lib/booking/rules";
import { loadTierConfig } from "@/lib/quotes/config";
import { TIER_LABELS, formatPeso, paymentPlanText, type PaymentTier } from "@/lib/quotes/rules";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/quotes/quotes.module.css";

export default function ProviderJob({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p role="status">Loading the job…</p>}><Job params={params} /></Suspense>;
}

type Quote = {
  id: string; status: "proposed" | "approved" | "accepted" | "declined" | "superseded" | "expired";
  amount: number; job_class: "minor" | "major"; notes: string | null; payment_tier: PaymentTier | null;
  deposit_amount: number | null; expires_at: string | null; decision_note: string | null; created_at: string;
};

async function Job({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/provider/jobs/${id}`);

  const { data: booking } = await supabase.from("bookings")
    .select("id,status,description,job_class,is_major_renovation,site_inspected_at,services(name)")
    .eq("id", id).eq("provider_id", user.id)
    .returns<Array<{
      id: string; status: BookingStatus; description: string | null; job_class: "minor" | "major" | null;
      is_major_renovation: boolean; site_inspected_at: string | null; services: { name: string } | null;
    }>>().maybeSingle();
  if (!booking) notFound();

  const [{ data: quotes }, { data: inspection }, { data: milestones }, config] = await Promise.all([
    supabase.from("quotes")
      .select("id,status,amount,job_class,notes,payment_tier,deposit_amount,expires_at,decision_note,created_at")
      .eq("booking_id", id).order("created_at", { ascending: false }).limit(1).returns<Quote[]>(),
    supabase.from("site_inspections").select("notes,created_at").eq("booking_id", id).maybeSingle(),
    supabase.from("milestones").select("position,title,amount").eq("booking_id", id).order("position"),
    loadTierConfig(),
  ]);
  const quote = quotes?.[0] ?? null;
  const isLarge = booking.job_class === "major" || booking.is_major_renovation;
  const needsInspection = isLarge && !booking.site_inspected_at;
  const canQuote = ["accepted", "quoted"].includes(booking.status) && !(quote && ["proposed", "approved", "accepted"].includes(quote.status));
  const sentBack = quote?.status === "declined" && booking.status === "quoted";

  return (
    <section className={styles.stack}>
      <PageHeading title={booking.services?.name ?? "Job"} description={STATUS_LABELS[booking.status]} />
      {booking.description && <p>{booking.description}</p>}
      <p><Link href={`/provider/chat?booking=${booking.id}`}>Message the customer</Link></p>

      {isLarge && inspection && (
        <div className={styles.card}>
          <h2 className={styles.heading}>Site inspection</h2>
          <p>{inspection.notes}</p>
          <span className={styles.muted}>Recorded {dayAndTime(inspection.created_at)}</span>
        </div>
      )}

      {quote && quote.status !== "superseded" && (
        <div className={`${styles.card} ${quote.status === "approved" ? styles.highlight : ""}`}>
          <div className={styles.head}>
            <span className={styles.title}>Your quote</span>
            <span className={styles.amount}>{formatPeso(quote.amount)}</span>
          </div>
          {quote.payment_tier && <span className={styles.tag}>{TIER_LABELS[quote.payment_tier]}</span>}
          {quote.payment_tier && <p className={styles.muted}>{paymentPlanText(quote.amount, quote.payment_tier, config)}</p>}
          {quote.status === "proposed" && <p>Waiting for an admin to approve.</p>}
          {quote.status === "approved" && <p>Approved. The customer has until {quote.expires_at ? dayAndTime(quote.expires_at) : "the deadline"} to answer.</p>}
          {quote.status === "accepted" && <p>The customer accepted. The job is scheduled once they pay.</p>}
          {sentBack && <p role="alert">Sent back{quote.decision_note ? `: ${quote.decision_note}` : "."} Send a corrected quote below.</p>}
          {quote.status === "expired" && <p role="alert">The customer did not answer in time. Send a new quote if the job is still on.</p>}
          {(milestones ?? []).length > 0 && (
            <table className={styles.table}>
              <caption className={styles.muted}>Milestones</caption>
              <thead><tr><th scope="col">Step</th><th scope="col">Amount</th></tr></thead>
              <tbody>{(milestones ?? []).map((m) => <tr key={m.position}><td>{m.position}. {m.title}</td><td>{formatPeso(Number(m.amount))}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}

      {canQuote && needsInspection && (
        <div>
          <h2 className={styles.heading}>Visit the site first</h2>
          <p className={styles.muted}>This is a large job. Go to the address, then record the inspection from your phone. You send the quote after that.</p>
          <InspectionForm bookingId={booking.id} />
        </div>
      )}
      {canQuote && !needsInspection && (
        <div>
          <h2 className={styles.heading}>{quote ? "Send a new quote" : "Send a quote"}</h2>
          <QuoteForm bookingId={booking.id} config={config} lockedMajor={isLarge} initialClass={isLarge ? "major" : "minor"} />
        </div>
      )}
      <p><Link href="/provider/jobs">Back to jobs</Link></p>
    </section>
  );
}
