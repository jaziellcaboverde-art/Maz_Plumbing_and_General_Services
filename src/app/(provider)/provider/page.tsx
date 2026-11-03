import Link from "next/link";
import { Suspense } from "react";
import { Inbox, BriefcaseBusiness, ClipboardClock } from "lucide-react";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { dayAndTime } from "@/lib/matching/format";
import { loadProviderJobs, providerSession } from "@/lib/provider/workspace";
import { officialStatus } from "@/lib/booking/official-status";
import styles from "@/components/provider/workspace.module.css";
import iconSize from "@/components/ui/icon-size.module.css";

export default function ProviderHome() {
  return (
    <Suspense fallback={<p role="status">Loading your workspace...</p>}>
      <Dashboard />
    </Suspense>
  );
}
async function Dashboard() {
  const { client, user, firstName } = await providerSession();
  const [jobsResult, offers, teamOffers, updates] = await Promise.all([
    loadProviderJobs(client, user.id),
    client
      .from("offers")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", user.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString()),
    client
      .from("provider_assignments")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", user.id)
      .eq("status", "offered")
      .gt("expires_at", new Date().toISOString()),
    client
      .from("provider_work_updates")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", user.id)
      .eq("review_status", "pending"),
  ]);
  if (jobsResult.error || offers.error || teamOffers.error || updates.error)
    return (
      <p role="alert">
        Could not load your workspace. Please refresh or contact MAZ for help.
      </p>
    );
  const active = (jobsResult.data ?? []).filter(
    (job) =>
      !job.ownWorkCompleted &&
      !["done", "signed", "balance_paid", "completed", "cancelled"].includes(
        job.status,
      ),
  );
  const upcoming = [...active].sort((a, b) =>
    (a.scheduled_start ?? "9999").localeCompare(b.scheduled_start ?? "9999"),
  );
  return (
    <section className={styles.stack}>
      <PageHeading
        title={"Welcome" + (firstName ? ", " + firstName : "")}
        description="All schedules use Philippine time."
      />
      <div className={styles.grid}>
        <Link className={styles.card} href="/provider/offers">
          <span className={styles.cardLabel}>
            <Inbox className={iconSize.md} aria-hidden="true" />
            Awaiting your response
          </span>
          <strong className={styles.number}>
            {(offers.count ?? 0) + (teamOffers.count ?? 0)}
          </strong>
          <span>Review assignment offers</span>
        </Link>
        <Link className={styles.card} href="/provider/jobs">
          <span className={styles.cardLabel}>
            <BriefcaseBusiness className={iconSize.md} aria-hidden="true" />
            Active assignments
          </span>
          <strong className={styles.number}>{active.length}</strong>
          <span>View assigned work</span>
        </Link>
        <Link className={styles.card} href="/provider/job-updates">
          <span className={styles.cardLabel}>
            <ClipboardClock className={iconSize.md} aria-hidden="true" />
            Awaiting MAZ review
          </span>
          <strong className={styles.number}>{updates.count ?? 0}</strong>
          <span>View your submissions</span>
        </Link>
      </div>
      <aside className={styles.banner}>
        <strong>Before your next assignment</strong>
        <p>
          Keep your availability current and review new offers. Follow the
          approved scope.
        </p>
        <Link href="/provider/schedule">Update availability</Link>
      </aside>
      <div className={styles.head}>
        <h2>Upcoming work</h2>
        <Link href="/provider/jobs">All assignments</Link>
      </div>
      {!upcoming.length ? (
        <EmptyState
          title="No active assignments"
          description="Offers from MAZ appear under Offers. Accepted work appears here."
        />
      ) : (
        <ul className={styles.list}>
          {upcoming.slice(0, 5).map((job) => (
            <li key={job.id} className={styles.card}>
              <div className={styles.head}>
                <strong>{job.services?.name ?? "Service assignment"}</strong>
                <span className={styles.tag}>
                  {job.official_status ?? officialStatus(job.status)}
                </span>
              </div>
              <p>
                {job.scheduled_start
                  ? "Confirmed appointment: " + dayAndTime(job.scheduled_start)
                  : "Appointment awaiting MAZ confirmation"}
              </p>
              <p className={styles.muted}>{job.description}</p>
              <Link href={"/provider/jobs/" + job.id}>Open assignment</Link>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.muted}>
        MAZ handles customer payments and project approvals.
      </p>
    </section>
  );
}
