import { ActionLink } from "@/components/ui/action-link";
import Link from "next/link";
import { Suspense } from "react";
import {
  Inbox,
  BriefcaseBusiness,
  ClipboardClock,
  CalendarDays,
} from "lucide-react";
import { PageHeading } from "@/components/layout/page-heading";
import { PortalStats, PortalPanel } from "@/components/layout/portal";
import portal from "@/components/layout/portal.module.css";
import { dayAndTime } from "@/lib/matching/format";
import { loadProviderJobs, providerSession } from "@/lib/provider/workspace";
import { officialStatus } from "@/lib/booking/official-status";
import styles from "@/components/provider/workspace.module.css";

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
      <PortalStats
        items={[
          {
            label: "Awaiting your response",
            value: (offers.count ?? 0) + (teamOffers.count ?? 0),
            href: "/provider/offers",
            icon: Inbox,
            tone: "warning",
          },
          {
            label: "Active assignments",
            value: active.length,
            href: "/provider/jobs",
            icon: BriefcaseBusiness,
          },
          {
            label: "Awaiting MAZ review",
            value: updates.count ?? 0,
            href: "/provider/job-updates",
            icon: ClipboardClock,
            tone: "neutral",
          },
        ]}
      />
      <div className={portal.columns}>
        <PortalPanel
          title="Upcoming work"
          icon={BriefcaseBusiness}
          action={
            <ActionLink href="/provider/jobs">All assignments</ActionLink>
          }
        >
          {!upcoming.length ? (
            <p className={portal.empty}>
              No active assignments. Check Offers for new work.
            </p>
          ) : (
            <ul className={portal.queueCards}>
              {upcoming.slice(0, 5).map((job) => (
                <li key={job.id}>
                  <Link
                    className={portal.queueCard}
                    href={"/provider/jobs/" + job.id}
                  >
                    <span className={portal.queueCardHead}>
                      <strong>
                        {job.services?.name ?? "Service assignment"}
                      </strong>
                      <span className={styles.tag}>
                        {job.official_status ?? officialStatus(job.status)}
                      </span>
                    </span>
                    <span className={portal.queueService}>
                      BK-{job.id.slice(0, 8)}
                    </span>
                    <span className={portal.queueDate}>
                      <CalendarDays aria-hidden="true" />
                      {job.scheduled_start
                        ? dayAndTime(job.scheduled_start)
                        : "Awaiting MAZ confirmation"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PortalPanel>
      </div>
      <p className={styles.muted}>
        MAZ handles customer payments and project approvals.
      </p>
    </section>
  );
}
