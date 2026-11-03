import Link from "next/link";
import { Suspense } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { dateOnly } from "@/lib/matching/format";
import { providerSession, loadProviderJobs } from "@/lib/provider/workspace";
import styles from "@/components/provider/workspace.module.css";
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading work history...</p>}>
      <History />
    </Suspense>
  );
}
async function History() {
  const { client, user } = await providerSession();
  const [jobs, feedback] = await Promise.all([
    loadProviderJobs(client, user.id),
    client
      .from("provider_feedback")
      .select("id,booking_id,stars,comment,created_at")
      .eq("provider_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (jobs.error || feedback.error)
    return <p role="alert">Could not load history and feedback.</p>;
  const completed = (jobs.data ?? []).filter(
    (j) =>
      j.ownWorkCompleted ||
      ["done", "signed", "balance_paid", "completed"].includes(j.status),
  );
  return (
    <section className={styles.stack}>
      <PageHeading
        title="History & private feedback"
        description="Completed MAZ assignments and optional customer feedback about your own work."
      />
      <aside className={styles.banner}>
        Worker feedback is private to you, the reviewing customer and MAZ.
        Company reviews are separate and are not copied to workers.
      </aside>
      <h2>Completed assignments</h2>
      {!completed.length ? (
        <EmptyState
          title="No completed assignments yet"
          description="MAZ-approved completed work appears here."
        />
      ) : (
        <ul className={styles.list}>
          {completed.map((j) => (
            <li className={styles.card} key={j.id}>
              <Link href={"/provider/jobs/" + j.id}>
                {j.services?.name ?? "Service assignment"}
              </Link>
              <span>{dateOnly(j.updated_at)}</span>
            </li>
          ))}
        </ul>
      )}
      <h2>Your private feedback</h2>
      {!feedback.data?.length ? (
        <EmptyState
          title="No private feedback yet"
          description="Optional feedback from customers about your assigned work appears here."
        />
      ) : (
        <ul className={styles.list}>
          {feedback.data.map((f) => (
            <li key={f.id} className={styles.card}>
              <strong>{f.stars}/5</strong>
              <p>{f.comment}</p>
              <span>{dateOnly(f.created_at)}</span>
              <Link href={"/provider/jobs/" + f.booking_id}>
                View assignment
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
