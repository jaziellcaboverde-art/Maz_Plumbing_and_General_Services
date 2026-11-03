import Link from "next/link";
import { Suspense } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { officialStatus } from "@/lib/booking/official-status";
import { dayAndTime } from "@/lib/matching/format";
import { loadProviderJobs, providerSession } from "@/lib/provider/workspace";
import styles from "@/components/provider/workspace.module.css";
export default function ProviderJobs() {
  return (
    <Suspense fallback={<p role="status">Loading assignments...</p>}>
      <Jobs />
    </Suspense>
  );
}
async function Jobs() {
  const { client, user } = await providerSession();
  const { data, error } = await loadProviderJobs(client, user.id);
  if (error)
    return (
      <p role="alert">Could not load assignments. Refresh to try again.</p>
    );
  const rows = (data ?? []).filter(
    (j) =>
      !j.ownWorkCompleted &&
      !["done", "signed", "balance_paid", "completed", "cancelled"].includes(
        j.status,
      ),
  );
  return (
    <section className={styles.stack}>
      <PageHeading
        title="My assignments"
        description="Your accepted work with MAZ. Appointment and project approvals remain with the MAZ team."
        trailing={<Link href="/provider/offers">Review offers</Link>}
      />
      {!rows.length ? (
        <EmptyState
          title="No active assignments"
          description="Accepted assignments will appear here. Check Offers for work from MAZ."
        />
      ) : (
        <ul className={styles.list}>
          {rows.map((j) => (
            <li key={j.id} className={styles.card}>
              <div className={styles.head}>
                <h2>{j.services?.name ?? "Service assignment"}</h2>
                <span className={styles.tag}>
                  {j.official_status ?? officialStatus(j.status)}
                </span>
              </div>
              <p>{j.description}</p>
              <p>
                {j.scheduled_start
                  ? "Confirmed appointment: " + dayAndTime(j.scheduled_start)
                  : "Awaiting appointment confirmation from MAZ"}
              </p>
              <Link href={"/provider/jobs/" + j.id}>
                View scope and submit updates
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
