import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PageHeading } from "@/components/layout/page-heading";
import { AutoRefresh } from "@/components/matching/auto-refresh";
import { ForemanChangeForm } from "@/components/matching/foreman-change-form";
import { MatchingKick } from "@/components/matching/matching-kick";
import { PayDeposit } from "@/components/payments/pay-deposit";
import { QuoteResponse } from "@/components/quotes/quote-response";
import { processExpiredOffers } from "@/lib/matching/engine";
import { loadTierConfig } from "@/lib/quotes/config";
import { processExpiredQuotes } from "@/lib/quotes/engine";
import { TIER_LABELS, formatPeso, paymentPlanText, type PaymentTier } from "@/lib/quotes/rules";
import quoteStyles from "@/components/quotes/quotes.module.css";
import { dayAndTime } from "@/lib/matching/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_LABELS, type BookingStatus } from "@/lib/booking/rules";
import { createClient } from "@/lib/supabase/server";
import { DeleteDraftButton } from "./delete-draft-button";
import styles from "./page.module.css";

export default function BookingDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ payment?: string }> }) {
  return <Suspense fallback={<p role="status">Loading your booking…</p>}><BookingDetail params={params} searchParams={searchParams} /></Suspense>;
}

const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Manila" });

async function BookingDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { id } = await params;
  const { payment: paymentFlag } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/customer/bookings/${id}`);

  const { data: booking } = await supabase.from("bookings")
    .select("id,status,description,preferred_start,is_urgent,is_major_renovation,job_class,created_at,cancel_reason,services(name,category),addresses(label,line1,barangay,city)")
    .eq("id", id).eq("customer_id", user.id)
    .returns<Array<{
      id: string; status: BookingStatus; description: string | null; preferred_start: string | null; is_urgent: boolean;
      is_major_renovation: boolean; job_class: "minor" | "major" | null; created_at: string; cancel_reason: string | null;
      services: { name: string; category: string } | null;
      addresses: { label: string | null; line1: string; barangay: string | null; city: string } | null;
    }>>()
    .maybeSingle();
  if (!booking) notFound();

  // Close offers that timed out so the page shows the true state, then read the matching details.
  const admin = createAdminClient();
  await processExpiredOffers(id, admin).catch((error) => console.error("expiry on booking page failed", error));
  await processExpiredQuotes(id, admin).catch((error) => console.error("quote expiry on booking page failed", error));
  const { data: live } = await admin.from("bookings")
    .select("status,is_urgent,job_class,needs_admin,needs_admin_reason,auto_chain,provider_id,miss_count")
    .eq("id", id).maybeSingle();
  const status = (live?.status ?? booking.status) as BookingStatus;
  const [{ data: pendingOffer }, { data: foreman }, { data: changeRequests }] = await Promise.all([
    admin.from("offers").select("provider_id,expires_at,kind").eq("booking_id", id).eq("status", "pending").maybeSingle(),
    live?.provider_id ? admin.from("profiles").select("first_name,last_name").eq("id", live.provider_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("foreman_change_requests").select("id,status,reason,decision_note,created_at").eq("booking_id", id).order("created_at", { ascending: false }).limit(3),
  ]);
  // The database only shows the customer a quote once an admin approved it.
  const [{ data: quoteRows }, { data: milestoneRows }, tierConfig] = await Promise.all([
    supabase.from("quotes").select("id,status,amount,payment_tier,deposit_amount,expires_at,notes")
      .eq("booking_id", id).in("status", ["approved", "accepted"]).order("created_at", { ascending: false }).limit(1)
      .returns<Array<{ id: string; status: "approved" | "accepted"; amount: number; payment_tier: PaymentTier | null; deposit_amount: number | null; expires_at: string | null; notes: string | null }>>(),
    supabase.from("milestones").select("position,title,amount").eq("booking_id", id).order("position"),
    loadTierConfig(admin),
  ]);
  const quote = quoteRows?.[0] ?? null;
  // Money the customer has paid or tried to pay (row level security: only their own).
  const [{ data: paymentRows }, { data: receiptRows }] = await Promise.all([
    supabase.from("payments").select("id,status,amount,failure_reason,paid_at").eq("booking_id", id).eq("kind", "deposit").order("created_at", { ascending: false }).limit(1),
    supabase.from("receipts").select("number,amount,issued_at").eq("booking_id", id).eq("kind", "deposit").order("issued_at", { ascending: false }).limit(1),
  ]);
  const deposit = paymentRows?.[0] ?? null;
  const receipt = receiptRows?.[0] ?? null;
  const offeredTo = pendingOffer
    ? (await admin.from("profiles").select("first_name,last_name").eq("id", pendingOffer.provider_id).maybeSingle()).data
    : null;
  const nameOf = (p: { first_name: string | null; last_name: string | null } | null) =>
    p ? `${p.first_name ?? "Provider"} ${p.last_name ? `${p.last_name[0]}.` : ""}`.trim() : "your provider";
  const isLarge = live?.job_class === "major" || booking.job_class === "major";
  const waiting = status === "open" || status === "offered";
  const pendingChange = (changeRequests ?? []).find((r) => r.status === "pending");
  const canAskForChange = isLarge && !!live?.provider_id && !pendingChange && ["accepted", "quoted", "deposit_paid", "scheduled"].includes(status);

  const { data: files } = await supabase.storage.from("booking-photos").list(id);
  const names = (files ?? []).filter((file) => file.name && !file.name.startsWith(".")).map((file) => `${id}/${file.name}`);
  const { data: signed } = names.length ? await supabase.storage.from("booking-photos").createSignedUrls(names, 3600) : { data: [] };
  const photos = (signed ?? []).flatMap((item) => (item.signedUrl ? [item.signedUrl] : []));

  const address = booking.addresses
    ? [booking.addresses.label, booking.addresses.line1, booking.addresses.barangay, booking.addresses.city].filter(Boolean).join(", ")
    : "Not chosen";

  return (
    <section className={styles.page}>
      <PageHeading title={booking.services?.name ?? "Booking"} description={STATUS_LABELS[status]} />
      {(waiting || (paymentFlag === "return" && status === "quoted")) && <AutoRefresh />}
      {booking.status === "draft" && (
        <p>This request has not been submitted yet. <Link href={`/customer/bookings/new?draft=${booking.id}`}>Continue this draft</Link></p>
      )}
      {status === "open" && isLarge && (
        <p>Your request is submitted. This is a large job, so our team will assign a foreman to oversee it and let you know.</p>
      )}
      {status === "open" && !isLarge && live?.needs_admin && (
        <p>Our team is finding a provider for you. We will let you know as soon as someone accepts.</p>
      )}
      {status === "open" && !isLarge && !live?.needs_admin && booking.is_urgent && <p>Finding an available provider for your urgent job…</p>}
      {status === "open" && !isLarge && !live?.needs_admin && !booking.is_urgent && (
        <p>
          {live && live.miss_count > 0 ? "That provider could not take the job. " : "Your request is submitted. "}
          <Link href={`/customer/bookings/${booking.id}/choose`}>Choose a provider</Link>
        </p>
      )}
      {status === "open" && (isLarge || booking.is_urgent) && !live?.needs_admin && <MatchingKick bookingId={booking.id} />}
      {status === "offered" && pendingOffer && (
        <p>
          {isLarge ? "We asked" : "You asked"} {nameOf(offeredTo)} to take this job. They have until {dayAndTime(pendingOffer.expires_at)} to answer.
          {live?.auto_chain ? " If they cannot, we will offer it to the next best provider." : ""}
        </p>
      )}
      {["accepted", "quoted", "deposit_paid", "scheduled", "on_the_way", "in_progress"].includes(status) && live?.provider_id && (
        <p>{isLarge ? "Your foreman" : "Your provider"}: {nameOf(foreman)}. <Link href={`/customer/chat?booking=${booking.id}`}>Message them</Link></p>
      )}
      {status === "quoted" && !quote && <p>Your provider is preparing your quote. We check every quote before it reaches you.</p>}
      {quote && quote.payment_tier && (
        <div className={`${quoteStyles.card} ${quote.status === "approved" ? quoteStyles.highlight : ""}`}>
          <div className={quoteStyles.head}>
            <span className={quoteStyles.title}>Your quote</span>
            <span className={quoteStyles.amount}>{formatPeso(Number(quote.amount))}</span>
          </div>
          <span className={quoteStyles.tag}>{TIER_LABELS[quote.payment_tier]}</span>
          {quote.notes && <p>{quote.notes}</p>}
          <p>{paymentPlanText(Number(quote.amount), quote.payment_tier, tierConfig)}</p>
          {(milestoneRows ?? []).length > 0 && (
            <table className={quoteStyles.table}>
              <caption className={quoteStyles.muted}>Milestones</caption>
              <thead><tr><th scope="col">Step</th><th scope="col">Amount</th></tr></thead>
              <tbody>{(milestoneRows ?? []).map((m) => <tr key={m.position}><td>{m.position}. {m.title}</td><td>{formatPeso(Number(m.amount))}</td></tr>)}</tbody>
            </table>
          )}
          {quote.status === "approved" && quote.expires_at && <p className={quoteStyles.muted}>Answer by {dayAndTime(quote.expires_at)}.</p>}
          {quote.status === "approved" && <QuoteResponse quoteId={quote.id} />}
          {quote.status === "accepted" && status === "quoted" && (
            <>
              {deposit?.status === "failed" && (
                <p role="alert">Your last payment did not go through{deposit.failure_reason ? `: ${deposit.failure_reason}` : ""}. No money was taken.</p>
              )}
              {paymentFlag === "cancelled" && <p>You left the payment page. Nothing was charged.</p>}
              {paymentFlag === "return" && <p role="status">Thank you. We are confirming your payment. This page updates in a moment.</p>}
              <p>You accepted this quote. Pay the {formatPeso(Number(quote.deposit_amount ?? 0))} deposit to confirm your booking. You can pay by card, GCash, Maya, GrabPay or QR Ph.</p>
              <PayDeposit bookingId={id} amountText={formatPeso(Number(quote.deposit_amount ?? 0))} retry={deposit?.status === "failed"} />
            </>
          )}
          {receipt && (
            <p role="status">Deposit paid: {formatPeso(Number(receipt.amount))}. Payment acknowledgment {receipt.number}, {dayAndTime(receipt.issued_at)}. Your booking is confirmed and can no longer be cancelled online. Contact us if something changed.</p>
          )}
        </div>
      )}
      {booking.status === "cancelled" && booking.cancel_reason && <p>Cancelled: {booking.cancel_reason}</p>}
      <dl className={styles.details}>
        <div><dt>Details</dt><dd>{booking.description ?? "Not written"}</dd></div>
        <div><dt>Address</dt><dd>{address}</dd></div>
        <div><dt>When</dt><dd>{booking.is_urgent ? "Urgent" : booking.preferred_start ? dateFormat.format(new Date(booking.preferred_start)) : "Not chosen"}</dd></div>
        {booking.job_class && <div><dt>Job size</dt><dd>{booking.job_class === "major" ? "Major" : "Minor"}</dd></div>}
      </dl>
      {photos.length > 0 && (
        <div>
          <h2 className={styles.heading}>Photos</h2>
          <ul className={styles.photos}>
            {photos.map((url, index) => (
              <li key={url}>
                {/* Signed links expire, so these are plain images rather than optimized ones. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.photo} src={url} alt={`Photo ${index + 1} of the job`} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {(changeRequests ?? []).length > 0 && (
        <div>
          <h2 className={styles.heading}>Foreman change</h2>
          <ul>
            {(changeRequests ?? []).map((r) => (
              <li key={r.id}>
                {r.status === "pending" ? "Waiting for an admin to decide" : r.status === "approved" ? "Approved. A new foreman was assigned" : `Declined${r.decision_note ? `: ${r.decision_note}` : ""}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      {canAskForChange && (
        <div>
          <h2 className={styles.heading}>Need a different foreman?</h2>
          <ForemanChangeForm bookingId={booking.id} />
        </div>
      )}
      {booking.status === "draft" && <DeleteDraftButton bookingId={booking.id} />}
      <p><Link href="/customer/bookings">Back to bookings</Link></p>
    </section>
  );
}
