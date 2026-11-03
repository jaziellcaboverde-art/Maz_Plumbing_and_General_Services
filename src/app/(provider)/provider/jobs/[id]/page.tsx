import { BookingSection } from "@/components/workflow/booking-section";
import { AssignmentReleaseForm } from "@/components/provider/assignment-release-form";
import Link from "next/link";
import { AcceptedProviderScope } from "@/components/workflow/accepted-provider-scope";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/layout/page-heading";
import { JobDayPanel } from "@/components/job/job-day-panel";
import { WorkUpdateForm } from "@/components/provider/work-update-form";
import { WorkUpdateList } from "@/components/provider/work-update-list";
import { officialStatus } from "@/lib/booking/official-status";
import { dayAndTime, peso } from "@/lib/matching/format";
import { providerSession, loadProviderJobs } from "@/lib/provider/workspace";
import { UUID } from "@/lib/matching/http";
import styles from "@/components/provider/workspace.module.css";
export default function ProviderJob({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p role="status">Loading assignment...</p>}>
      <Job params={params} />
    </Suspense>
  );
}
async function Job({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { client, user } = await providerSession();
  const result = await loadProviderJobs(client, user.id);
  if (result.error) return <p role="alert">Could not load this assignment.</p>;
  const job = result.data?.find((j) => j.id === id);
  if (!job) notFound();
  const [quotes, milestones, assignments, updates, workDay] = await Promise.all(
    [
      client
        .from("quotes")
        .select("id,status,amount,notes,created_at")
        .eq("booking_id", id)
        .in("status", ["approved", "accepted"])
        .order("created_at", { ascending: false })
        .limit(1),
      client
        .from("milestones")
        .select("id,title,position,status")
        .eq("booking_id", id)
        .order("position"),
      client
        .from("provider_assignments")
        .select("id,trade,phase,starts_at,ends_at,status")
        .eq("booking_id", id)
        .eq("provider_id", user.id),
      client
        .from("provider_work_updates")
        .select("*")
        .eq("booking_id", id)
        .eq("provider_id", user.id)
        .order("created_at", { ascending: false }),
      client
        .from("work_days")
        .select("arrived_at,closed_at")
        .eq("booking_id", id)
        .eq("provider_id", user.id)
        .eq(
          "work_date",
          new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
            new Date(),
          ),
        )
        .maybeSingle(),
    ],
  );
  if (
    quotes.error ||
    milestones.error ||
    assignments.error ||
    updates.error ||
    workDay.error
  )
    return (
      <p role="alert">
        Could not load the complete job record. Please refresh.
      </p>
    );
  const quote = quotes.data?.[0];
  const closed =
    job.ownWorkCompleted ||
    ["done", "signed", "balance_paid", "completed", "cancelled"].includes(
      job.status,
    );
  const dayStatus = [
    "deposit_paid",
    "scheduled",
    "on_the_way",
    "in_progress",
  ].includes(job.status)
    ? (job.status as
        "deposit_paid" | "scheduled" | "on_the_way" | "in_progress")
    : null;
  return (
    <section className={styles.stack}>
      <PageHeading
        title={job.services?.name ?? "Service assignment"}
        description={
          job.official_status ?? officialStatus(job.status) ?? "Assignment"
        }
        trailing={<Link href="/provider/jobs">Assignments</Link>}
      />
      <div className={styles.banner}>
        <strong>Follow the MAZ-approved scope</strong>
        <p>
          Send findings and evidence to MAZ. Get approval before doing extra
          work.
        </p>
      </div>
      <div className={styles.grid}>
        <article className={styles.card}>
          <h2>Work request</h2>
          <p>{job.description ?? "Refer to MAZ for the detailed scope."}</p>
          <p>
            {job.scheduled_start
              ? "Confirmed appointment: " + dayAndTime(job.scheduled_start)
              : "Appointment awaiting MAZ confirmation"}
          </p>
          <Link href={"/provider/chat?booking=" + id}>Booking messages</Link>
        </article>
        <article className={styles.card}>
          <h2>Approved quotation / scope</h2>
          {quote ? (
            <>
              <strong>{peso(Number(quote.amount))}</strong>
              <p>{quote.notes}</p>
              <span>
                {quote.status === "accepted"
                  ? "Customer approved"
                  : "Awaiting customer approval"}
              </span>
            </>
          ) : (
            <p>
              MAZ is preparing the quotation. Send findings and advisory
              estimates; wait for approved scope before execution.
            </p>
          )}
        </article>
      </div>
      {!!assignments.data?.length && (
        <BookingSection title="Your project roles">
          <ul className={styles.list}>
            {assignments.data.map((a) => (
              <li key={a.id}>
                <strong>
                  {a.trade} - {a.phase}
                </strong>
                <p>
                  {dayAndTime(a.starts_at)} to {dayAndTime(a.ends_at)}{" "}
                  (Philippine time)
                </p>
                <span>{a.status.replaceAll("_", " ")}</span>
                {a.status === "accepted" && <AssignmentReleaseForm id={a.id} />}
              </li>
            ))}
          </ul>
        </BookingSection>
      )}
      {!!milestones.data?.length && (
        <BookingSection title="Project milestones">
          <ol>
            {milestones.data.map((m) => (
              <li key={m.id}>
                {m.title} ?{" "}
                {m.status === "confirmed"
                  ? "Approved by MAZ"
                  : m.status === "submitted"
                    ? "Awaiting MAZ review"
                    : "Pending evidence"}
              </li>
            ))}
          </ol>
        </BookingSection>
      )}
      {dayStatus && job.provider_id === user.id && (
        <article className={styles.card}>
          <h2>Job day</h2>
          <JobDayPanel
            bookingId={id}
            status={dayStatus}
            scheduledStartText={
              job.scheduled_start ? dayAndTime(job.scheduled_start) : null
            }
            defaultStartLocal=""
            checkedInToday={!!workDay.data?.arrived_at}
            dayClosedToday={!!workDay.data?.closed_at}
          />
        </article>
      )}
      {!closed && (
        <article className={styles.card}>
          <WorkUpdateForm
            bookingId={id}
            inProgress={job.status === "in_progress"}
            milestones={milestones.data ?? []}
          />
        </article>
      )}
      <AcceptedProviderScope bookingId={id} />
      <h2>Your submissions and MAZ decisions</h2>
      <WorkUpdateList updates={updates.data ?? []} />
    </section>
  );
}
