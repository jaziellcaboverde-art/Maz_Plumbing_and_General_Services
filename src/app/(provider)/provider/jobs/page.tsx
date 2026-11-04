import { BookingWorkspace } from "@/components/workflow/booking-workspace";
import { BookingSection } from "@/components/workflow/booking-section";
import HistoryPage from "../history/page";
import UpdatesPage from "../job-updates/page";
import { ActionLink } from "@/components/ui/action-link";
import { Suspense } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { PortalTable } from "@/components/layout/portal";
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
        description="Your MAZ assignments and appointments."
        trailing={
          <ActionLink href="/provider/offers">Assignment history</ActionLink>
        }
      />
      <BookingWorkspace>
        <BookingSection title="Active assignments">
          <PortalTable
            label="Active assignments"
            columns={["Assignment", "Service", "Schedule", "Status", "Action"]}
            empty="No active assignments. MAZ will notify you when work is assigned."
            rows={rows.map((j) => ({
              key: j.id,
              cells: [
                j.id.slice(0, 8).toUpperCase(),
                <div key="service">
                  <strong>{j.services?.name ?? "Service assignment"}</strong>
                  <p>{j.description}</p>
                </div>,
                j.scheduled_start
                  ? dayAndTime(j.scheduled_start)
                  : "Awaiting MAZ confirmation",
                <span key="status" className={styles.tag}>
                  {j.official_status ?? officialStatus(j.status)}
                </span>,
                <ActionLink key="action" href={"/provider/jobs/" + j.id}>
                  View assignment
                </ActionLink>,
              ],
            }))}
          />
        </BookingSection>
        <BookingSection title="Work history">
          <HistoryPage />
        </BookingSection>
        <BookingSection title="Work updates">
          <UpdatesPage />
        </BookingSection>
      </BookingWorkspace>
    </section>
  );
}
