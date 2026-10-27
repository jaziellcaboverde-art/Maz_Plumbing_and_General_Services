import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PageHeading } from "@/components/layout/page-heading";
import { AutoRefresh } from "@/components/matching/auto-refresh";
import { ForemanChangeForm } from "@/components/matching/foreman-change-form";
import { MatchingKick } from "@/components/matching/matching-kick";
import { processExpiredOffers } from "@/lib/matching/engine";
import { dayAndTime } from "@/lib/matching/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_LABELS, type BookingStatus } from "@/lib/booking/rules";
import { createClient } from "@/lib/supabase/server";
import { DeleteDraftButton } from "./delete-draft-button";
import styles from "./page.module.css";

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p role="status">Loading your booking…</p>}><BookingDetail params={params} /></Suspense>;
}

const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Manila" });

async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const { data: live } = await admin.from("bookings")
    .select("status,is_urgent,job_class,needs_admin,needs_admin_reason,auto_chain,provider_id,miss_count")
    .eq("id", id).maybeSingle();
  const status = (live?.status ?? booking.status) as BookingStatus;
  const [{ data: pendingOffer }, { data: foreman }, { data: changeRequests }] = await Promise.all([
    admin.from("offers").select("provider_id,expires_at,kind").eq("booking_id", id).eq("status", "pending").maybeSingle(),
    live?.provider_id ? admin.from("profiles").select("first_name,last_name").eq("id", live.provider_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("foreman_change_requests").select("id,status,reason,decision_note,created_at").eq("booking_id", id).order("created_at", { ascending: false }).limit(3),
  ]);
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
        <p>{isLarge ? "Your foreman" : "Your provider"}: {nameOf(foreman)}. <Link href={`/customer/chat?booking=${booking.id}`}>Message them</Link></p>
      )}
      <p><Link href={`/customer/chat?support=1&bookingRef=${booking.id}`}>Message support about this job</Link></p>
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
