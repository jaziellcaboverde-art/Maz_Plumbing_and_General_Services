import { createClient } from "@/lib/supabase/server";
import styles from "./workflow.module.css";
export async function AcceptedProviderScope({
  bookingId,
}: {
  bookingId: string;
}) {
  const client = await createClient();
  const { data, error } = await client
    .from("project_documents")
    .select("id,kind,version,title,body")
    .eq("booking_id", bookingId)
    .eq("status", "accepted")
    .order("created_at");
  if (error)
    return <p role="alert">Approved scope changes could not be loaded.</p>;
  if (!data?.length) return null;
  return (
    <section className={styles.card}>
      <h2>Customer-approved contract and scope changes</h2>
      {data.map((d) => (
        <article key={d.id}>
          <strong>
            {d.title} - v{d.version}
          </strong>
          <p className={styles.document}>{d.body}</p>
        </article>
      ))}
    </section>
  );
}
