import { createClient } from "@/lib/supabase/server";
import { dayAndTime } from "@/lib/matching/format";

import styles from "./workspace.module.css";
export async function AppointmentProposals({
  bookingId,
}: {
  bookingId: string;
}) {
  const client = await createClient();
  const { data, error } = await client
    .from("provider_appointment_requests")
    .select("id,phase,starts_at,ends_at,status")
    .eq("booking_id", bookingId)
    .eq("status", "accepted")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at");
  if (error)
    return <p role="alert">Proposed appointments could not be loaded.</p>;
  if (!data?.length) return null;
  return (
    <section className={styles.card}>
      <h2>Assigned schedule</h2>
      <p>
        MAZ has assigned this schedule. No customer approval is required.
      </p>
      {data.map((r) => (
        <article className={styles.card} key={r.id}>
          <strong>
            {r.phase === "inspection"
              ? "Inspection visit"
              : "Execution work period"}
          </strong>
          <p>
            {dayAndTime(r.starts_at)} to {dayAndTime(r.ends_at)} (Philippine
            time)
          </p>
        </article>
      ))}
    </section>
  );
}
