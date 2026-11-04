import { ActionLink } from "@/components/ui/action-link";
import { Suspense } from "react";
import { PageHeading } from "@/components/layout/page-heading";

import { EmptyState } from "@/components/ui/empty-state";

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
  const { data, error } = await supabase.rpc("my_offers");
  if (error)
    return (
      <p role="alert">Could not load offers. Refresh the page to try again.</p>
    );
  const rows = (data ?? []) as Row[];
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
  return (
    <section className={styles.stack}>
      <PageHeading
        title="Assignment history"
        description="MAZ assigns work directly using your availability. No acceptance is needed."
      />
      {!teamRows.length && !rows.length && (
        <EmptyState
          title="No assignments yet"
          description="New work will appear in My assignments."
        />
      )}
      {teamRows.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.heading}>Project assignments</h2>
          <ul className={styles.list}>
            {teamRows.map((a) => (
              <li key={a.id} className={styles.card}>
                <strong>
                  {a.service_name ?? "Project"} ? {a.trade}
                </strong>
                <span>
                  {a.status === "accepted"
                    ? "Assigned"
                    : a.status === "offered"
                      ? "Previous offer - ask MAZ to reassign"
                      : a.status.replaceAll("_", " ")}
                </span>
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
      {rows.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.heading}>Earlier records</h2>
          <ul className={styles.list}>
            {rows.map((row) => (
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
