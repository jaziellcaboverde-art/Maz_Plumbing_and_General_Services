import Link from "next/link";
import { Suspense } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { AutoRefresh } from "@/components/matching/auto-refresh";
import { OfferCard, type OfferView } from "@/components/matching/offer-card";
import { RequestCard, type RequestView } from "@/components/matching/request-card";
import { EmptyState } from "@/components/ui/empty-state";
import { processExpiredOffers } from "@/lib/matching/engine";
import { dayAndTime } from "@/lib/matching/format";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/matching/matching.module.css";

export default function ProviderHome() {
  return <Suspense fallback={<p role="status">Loading your offers…</p>}><Offers /></Suspense>;
}

type OfferRow = {
  offer_id: string; booking_id: string; kind: string; status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
  expires_at: string; created_at: string; service_name: string | null; description: string | null; is_urgent: boolean;
  preferred_start: string | null; job_class: "minor" | "major" | null; barangay: string | null; city: string | null; distance_m: number | null;
};

type RequestRow = {
  booking_id: string; service_name: string; description: string | null; preferred_start: string | null;
  barangay: string | null; city: string | null; distance_m: number | null; interested: boolean;
};

const PAST_LABEL: Record<string, string> = { accepted: "Accepted", declined: "Declined", expired: "Ran out of time", cancelled: "Cancelled by the customer" };

async function Offers() {
  // Close timed out offers first so a stale offer is never shown as open.
  await processExpiredOffers().catch((error) => console.error("expiry on offers page failed", error));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_offers");
  if (error) return <p role="alert">Could not load your offers. Refresh the page to try again.</p>;
  const rows = (data ?? []) as OfferRow[];
  const pending: OfferView[] = rows.filter((r) => r.status === "pending").map((r) => ({
    offerId: r.offer_id, kind: r.kind, serviceName: r.service_name ?? "Job", description: r.description ?? "",
    isUrgent: r.is_urgent, preferredStart: r.preferred_start,
    area: [r.barangay, r.city].filter(Boolean).join(", ") || "Area not shown", distanceM: r.distance_m,
    expiresAt: r.expires_at, isForeman: r.kind === "foreman",
  }));
  const past = rows.filter((r) => r.status !== "pending");
  const { data: requestData } = await supabase.rpc("open_requests_for_me");
  const requests: RequestView[] = ((requestData ?? []) as RequestRow[]).map((r) => ({
    bookingId: r.booking_id, serviceName: r.service_name, description: r.description ?? "",
    preferredStart: r.preferred_start, area: [r.barangay, r.city].filter(Boolean).join(", ") || "Area not shown",
    distanceM: r.distance_m, interested: r.interested,
  }));

  return (
    <section className={styles.stack}>
      <PageHeading title="Offers" description="Jobs customers or our team would like you to take." />
      {pending.length > 0 && <AutoRefresh everySeconds={30} />}
      {pending.length === 0 ? (
        <EmptyState title="No offers right now" description="When a customer picks you or an urgent job is sent to you, it shows up here and in your notifications." />
      ) : (
        <ul className={styles.list} aria-label="Open offers">
          {pending.map((offer) => <OfferCard key={offer.offerId} offer={offer} />)}
        </ul>
      )}
      {requests.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.heading}>Customers looking for your skills</h2>
          <p className={styles.muted}>These jobs match the services on your profile. Tap &quot;I can do this&quot; and the customer can choose you, even if you are far from them.</p>
          <ul className={styles.list} aria-label="Open requests">
            {requests.map((request) => <RequestCard key={request.bookingId} request={request} />)}
          </ul>
        </div>
      )}
      {past.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.heading}>Earlier offers</h2>
          <ul className={styles.list}>
            {past.map((r) => (
              <li key={r.offer_id} className={styles.card}>
                <div className={styles.head}>
                  <span className={styles.name}>{r.service_name ?? "Job"}</span>
                  <span className={styles.tag}>{PAST_LABEL[r.status] ?? r.status}</span>
                </div>
                <div className={styles.facts}><span>Offered {dayAndTime(r.created_at)}</span></div>
                {r.status === "accepted" && <p><Link href={`/provider/chat?booking=${r.booking_id}`}>Open the chat with the customer</Link></p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
