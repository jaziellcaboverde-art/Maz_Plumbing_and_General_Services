import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { StatusBadge } from "@/components/booking/status-badge";
import { PageHeading } from "@/components/layout/page-heading";
import { AutoRefresh } from "@/components/matching/auto-refresh";
import { ForemanChangeForm } from "@/components/matching/foreman-change-form";
import { MatchingKick } from "@/components/matching/matching-kick";
import { processExpiredOffers } from "@/lib/matching/engine";
import { dayAndTime, peso, ratingText } from "@/lib/matching/format";
import { customerCanChange, officialStatus, paymentStatusFor } from "@/lib/booking/official-status";
import { loadProviderSummaries } from "@/lib/booking/provider-summary";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingStatus } from "@/lib/booking/rules";
import { createClient } from "@/lib/supabase/server";
import { DeleteDraftButton } from "./delete-draft-button";
import { PendingBookingActions } from "./pending-booking-actions";
import { ReviewForm } from "./review-form";
import { StatusTimeline } from "./status-timeline";
import styles from "./page.module.css";

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p role="status">Loading your booking…</p>}><BookingDetail params={params} /></Suspense>;
}


async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/customer/bookings/${id}`);

  const { data: booking } = await supabase.from("bookings")
    .select("id,status,description,preferred_start,is_urgent,is_major_renovation,job_class,created_at,cancel_reason,quote_total,services(name,category),addresses(label,line1,barangay,city)")
    .eq("id", id).eq("customer_id", user.id)
    .returns<Array<{
      id: string; status: BookingStatus; description: string | null; preferred_start: string | null; is_urgent: boolean;
      is_major_renovation: boolean; job_class: "minor" | "major" | null; created_at: string; cancel_reason: string | null; quote_total: number | null;
      services: { name: string; category: string } | null;
      addresses: { label: string | null; line1: string; barangay: string | null; city: string } | null;
    }>>()
    .maybeSingle();
  if (!booking) notFound();

  // Close offers that timed out so the page shows the true state, then read the matching details.
  const admin = createAdminClient();
  await processExpiredOffers(id, admin).catch((error) => console.error("expiry on booking page failed", error));
  const { data: live } = await admin.from("bookings")
    .select("status,is_urgent,job_class,needs_admin,needs_admin_reason,auto_chain,provider_id,miss_count")
    .eq("id", id).maybeSingle();
  const status = (live?.status ?? booking.status) as BookingStatus;
  const [{ data: pendingOffer }, { data: foreman }, { data: changeRequests }] = await Promise.all([
    admin.from("offers").select("provider_id,expires_at,kind").eq("booking_id", id).eq("status", "pending").maybeSingle(),
    live?.provider_id ? admin.from("profiles").select("first_name,last_name").eq("id", live.provider_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("foreman_change_requests").select("id,status,reason,decision_note,created_at").eq("booking_id", id).order("created_at", { ascending: false }).limit(3),
  ]);
  const [{ data: quote }, { data: payments }, { data: cashRecords }, { data: review }] = await Promise.all([
    supabase.from("quotes").select("amount,status,notes,created_at").eq("booking_id", id).neq("status", "superseded").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("payments").select("id,kind,amount,status,method,paid_at,created_at").eq("booking_id", id).order("created_at"),
    supabase.from("cash_records").select("id,amount,collected_on,reference").eq("booking_id", id).order("collected_on"),
    supabase.from("reviews").select("stars,comment").eq("booking_id", id).maybeSingle(),
  ]);
  const providerSummary = live?.provider_id ? (await loadProviderSummaries(admin, [live.provider_id])).get(live.provider_id) : undefined;
  const offeredTo = pendingOffer
    ? (await admin.from("profiles").select("first_name,last_name").eq("id", pendingOffer.provider_id).maybeSingle()).data
    : null;
  const nameOf = (p: { first_name: string | null; last_name: string | null } | null) =>
    p ? `${p.first_name ?? "Provider"} ${p.last_name ? `${p.last_name[0]}.` : ""}`.trim() : "your provider";
  const isLarge = live?.job_class === "major" || booking.job_class === "major";
  const waiting = status === "open" || status === "offered";
  const pendingChange = (changeRequests ?? []).find((r) => r.status === "pending");
  const official = officialStatus(status);
  const quoteAmount = quote ? Number(quote.amount) : booking.quote_total === null ? null : Number(booking.quote_total);
  const paidPayments = (payments ?? []).filter((payment) => payment.status === "paid");
  const paidTotal = paidPayments.reduce((sum, payment) => sum + Number(payment.amount), 0) + (cashRecords ?? []).reduce((sum, record) => sum + Number(record.amount), 0);
  const paymentStatus = paymentStatusFor({ status, quoteTotal: quoteAmount, paidTotal });
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
      <PageHeading title={booking.services?.name ?? "Booking"} trailing={official ? <StatusBadge status={official} /> : undefined} />
      {official && <StatusTimeline status={official} />}
      {customerCanChange(status) && (
        <div className={styles.card}>
          <p className={styles.muted}>Your request is Pending. You can change the schedule or cancel it until it is accepted. After that, message support.</p>
          <PendingBookingActions bookingId={booking.id} preferredStart={booking.preferred_start} isUrgent={booking.is_urgent} />
        </div>
      )}
      {waiting && <AutoRefresh />}
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
        <p><Link href={`/customer/chat?booking=${booking.id}`}>Message {nameOf(foreman)}</Link></p>
      )}
      <p><Link href={`/customer/chat?support=1&bookingRef=${booking.id}`}>Message support about this job</Link></p>
      {booking.status === "cancelled" && booking.cancel_reason && <p>Cancelled: {booking.cancel_reason}</p>}
      <dl className={styles.details}>
        <div><dt>Details</dt><dd>{booking.description ?? "Not written"}</dd></div>
        <div><dt>Location</dt><dd>{address}</dd></div>
        <div><dt>Schedule</dt><dd>{booking.is_urgent ? "Urgent (same day)" : booking.preferred_start ? dayAndTime(booking.preferred_start) : "Not chosen"}</dd></div>
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
      {providerSummary && (
        <div className={styles.card}>
          <h2 className={styles.heading}>{isLarge ? "Your foreman" : "Your provider"}</h2>
          <p><strong>{providerSummary.name}</strong></p>
          <p className={styles.muted}>{providerSummary.skills.length ? providerSummary.skills.join(", ") : "Skills not listed yet"}</p>
          <p className={styles.muted}>{providerSummary.jobsDone} {providerSummary.jobsDone === 1 ? "job" : "jobs"} done · {ratingText(providerSummary.averageRating ?? 0, providerSummary.reviewCount)}</p>
        </div>
      )}
      <div className={styles.card}>
        <h2 className={styles.heading}>Quote</h2>
        {quoteAmount !== null ? (
          <>
            <p><strong>{peso(quoteAmount)}</strong>{quote?.status ? <span className={styles.muted}> · {quote.status === "proposed" ? "waiting for your approval" : quote.status}</span> : null}</p>
            {quote?.notes && <p className={styles.muted}>{quote.notes}</p>}
          </>
        ) : (
          <p className={styles.muted}>No quote yet. The price is not final until the provider inspects the site.</p>
        )}
      </div>
      {official !== null && official !== "Cancelled" && (
        <div className={styles.card}>
          <h2 className={styles.heading}>Payment</h2>
          {quoteAmount !== null ? (
            <p>Paid {peso(paidTotal)} of {peso(quoteAmount)} · {paymentStatus}</p>
          ) : (
            <p className={styles.muted}>Payment details appear after you approve a quote. Payments are made outside the app and recorded by our team.</p>
          )}
          {(paidPayments.length > 0 || (cashRecords ?? []).length > 0) && (
            <ul className={styles.records} aria-label="Payment records">
              {paidPayments.map((payment) => (
                <li key={payment.id} className={styles.record}>
                  <span>{payment.kind === "deposit" ? "Deposit" : payment.kind === "balance" ? "Balance" : "Milestone"}{payment.method ? ` · ${payment.method.toUpperCase()}` : ""}</span>
                  <span>{peso(Number(payment.amount))}{payment.paid_at ? ` · ${dayAndTime(payment.paid_at)}` : ""}</span>
                </li>
              ))}
              {(cashRecords ?? []).map((record) => (
                <li key={record.id} className={styles.record}>
                  <span>Cash · ref {record.reference}</span>
                  <span>{peso(Number(record.amount))} · {dayAndTime(`${record.collected_on}T00:00:00+08:00`)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {official === "Completed" && providerSummary && (
        <div className={styles.card}>
          <h2 className={styles.heading}>Rate and review</h2>
          {review ? <p>You gave {review.stars} {review.stars === 1 ? "star" : "stars"}{review.comment ? `: ${review.comment}` : "."}</p>
            : <ReviewForm bookingId={booking.id} providerName={providerSummary.name} />}
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
