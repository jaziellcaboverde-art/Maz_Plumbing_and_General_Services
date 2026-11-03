import { createClient } from "@/lib/supabase/server";
import { dayAndTime } from "@/lib/matching/format";
import { AppointmentResponse } from "./appointment-response";
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
    .eq("status", "pending")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at");
  if (error)
    return <p role="alert">Proposed appointments could not be loaded.</p>;
  if (!data?.length) return null;
  return (
    <section className={styles.card}>
      <h2>MAZ proposed appointments</h2>
      <p>
        Review the proposed inspection or work period. MAZ confirms the
        appointment after the team and approved scope are ready.
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
          <AppointmentResponse bookingId={bookingId} proposalId={r.id} />
        </article>
      ))}
    </section>
  );
}
