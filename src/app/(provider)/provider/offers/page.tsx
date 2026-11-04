import { ActionLink } from "@/components/ui/action-link";
import { Suspense } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { AutoRefresh } from "@/components/matching/auto-refresh";
import { OfferCard, type OfferView } from "@/components/matching/offer-card";
import { EmptyState } from "@/components/ui/empty-state";
import { processExpiredOffers } from "@/lib/matching/engine";
import { dayAndTime } from "@/lib/matching/format";
import { providerSession } from "@/lib/provider/workspace";
import styles from "@/components/matching/matching.module.css";

type Row = {
  offer_id: string;
  booking_id: string;
  kind: string;
  status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
  expires_at: string;
  created_at: string;
  service_name: string | null;
  description: string | null;
  is_urgent: boolean;
  preferred_start: string | null;
  barangay: string | null;
  city: string | null;
  distance_m: number | null;
};
const PAST: Record<string, string> = {
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

export default function ProviderOffers() {
  return (
    <Suspense fallback={<p role="status">Loading offers…</p>}>
      <Offers />
    </Suspense>
  );
}

async function Offers() {
  const { client: supabase } = await providerSession();
  await processExpiredOffers().catch((error) =>
    console.error("expiry on offers page failed", error),
  );
  const { data, error } = await supabase.rpc("my_offers");
  if (error)
    return (
      <p role="alert">Could not load offers. Refresh the page to try again.</p>
    );
  const rows = (data ?? []) as Row[];
  // This is a request-time Server Component: providerSession awaited connection().
  // Expiry must use the server clock rather than a cached render timestamp.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const pending: OfferView[] = rows
    .filter(
      (row) =>
        row.status === "pending" && Date.parse(row.expires_at) > now,
    )
    .map((row) => ({
      offerId: row.offer_id,
      kind: row.kind,
      serviceName: row.service_name ?? "Job",
      description: row.description ?? "",
      isUrgent: row.is_urgent,
      preferredStart: row.preferred_start,
      area:
        [row.barangay, row.city].filter(Boolean).join(", ") || "Area not shown",
      distanceM: row.distance_m,
      expiresAt: row.expires_at,
      isForeman: row.kind === "foreman",
    }));
  const { data: team, error: teamError } = await supabase.rpc("my_team_offers");
  if (teamError) return <p role="alert">Could not load project offers.</p>;
  type TeamOffer = {
    id: string;
    booking_id: string;
    trade: string;
    phase: string;
    starts_at: string;
    ends_at: string;
    expires_at: string;
    status: string;
    service_name: string | null;
    description: string | null;
    area: string;
  };
  const teamRows = (team ?? []) as TeamOffer[];
  pending.push(
    ...teamRows
      .filter((a) => a.status === "offered")
      .map((a) => ({
        offerId: a.id,
        kind: a.phase,
        serviceName: a.service_name ?? "Project assignment",
        description: a.description ?? "",
        isUrgent: false,
        preferredStart: a.starts_at,
        endsAt: a.ends_at,
        area: a.area || "Area to be confirmed",
        distanceM: null,
        expiresAt: a.expires_at,
        isForeman: false,
        role: a.trade + " | " + a.phase,
        responseUrl: "/api/provider/assignments/" + a.id + "/respond",
      })),
  );
  return (
    <section className={styles.stack}>
      <PageHeading
        title="Offers and assignments"
        description="Review jobs sent to you and respond before they expire."
      />
      {pending.length > 0 && <AutoRefresh everySeconds={30} />}
      {pending.length === 0 ? (
        <EmptyState
          title="No offers right now"
          description="New assignments will appear here and in your notifications."
        />
      ) : (
        <ul className={styles.list}>
          {pending.map((offer) => (
            <OfferCard key={offer.offerId} offer={offer} />
          ))}
        </ul>
      )}
      {teamRows.some((a) => a.status !== "offered") && (
        <div className={styles.section}>
          <h2 className={styles.heading}>Project offer history</h2>
          <ul className={styles.list}>
            {teamRows
              .filter((a) => a.status !== "offered")
              .map((a) => (
                <li key={a.id} className={styles.card}>
                  <strong>
                    {a.service_name ?? "Project"} ? {a.trade}
                  </strong>
                  <span>{a.status.replaceAll("_", " ")}</span>
                  {["accepted", "completed"].includes(a.status) && (
                    <ActionLink href={"/provider/jobs/" + a.booking_id}>
                      Open assignment
                    </ActionLink>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
      {rows.some((row) => row.status !== "pending") && (
        <div className={styles.section}>
          <h2 className={styles.heading}>Earlier offers</h2>
          <ul className={styles.list}>
            {rows
              .filter((row) => row.status !== "pending")
              .map((row) => (
                <li key={row.offer_id} className={styles.card}>
                  <div className={styles.head}>
                    <span className={styles.name}>
                      {row.service_name ?? "Job"}
                    </span>
                    <span className={styles.tag}>
                      {PAST[row.status] ?? row.status}
                    </span>
                  </div>
                  <div className={styles.facts}>
                    <span>Offered {dayAndTime(row.created_at)}</span>
                  </div>
                  {row.status === "accepted" && (
                    <ActionLink href={`/provider/jobs/${row.booking_id}`}>
                      Open job
                    </ActionLink>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
