import Link from "next/link";
import { Suspense } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { WeeklyHoursForm } from "@/components/provider/weekly-hours-form";
import { EmptyState } from "@/components/ui/empty-state";
import { providerSession } from "@/lib/provider/workspace";
import { dayAndTime } from "@/lib/matching/format";
import { AvailabilityForm } from "./availability-form";
import styles from "@/components/provider/workspace.module.css";
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading schedule...</p>}>
      <Schedule />
    </Suspense>
  );
}
async function Schedule() {
  const { client, user } = await providerSession();
  const now = new Date().toISOString();
  const [weekly, exceptions, assignments, leadJobs] = await Promise.all([
    client
      .from("provider_weekly_hours")
      .select("weekday,starts_at,ends_at")
      .eq("provider_id", user.id)
      .order("weekday"),
    client
      .from("provider_availability")
      .select("id,starts_at,ends_at,kind,note")
      .eq("provider_id", user.id)
      .gte("ends_at", now)
      .order("starts_at"),
    client
      .from("provider_assignments")
      .select("id,booking_id,trade,status,starts_at,ends_at,expires_at")
      .eq("provider_id", user.id)
      .in("status", ["offered", "accepted", "withdrawal_requested"])
      .gte("ends_at", now)
      .order("starts_at"),
    client
      .from("bookings")
      .select("id,scheduled_start,services(name)")
      .eq("provider_id", user.id)
      .gte("scheduled_start", now)
      .not("status", "in", "(cancelled,completed,done,signed,balance_paid)")
      .order("scheduled_start")
      .returns<
        {
          id: string;
          scheduled_start: string | null;
          services: { name: string } | null;
        }[]
      >(),
  ]);
  if (weekly.error || exceptions.error || assignments.error || leadJobs.error)
    return (
      <p role="alert">Could not load the complete schedule. Please refresh.</p>
    );
  const blocks = (assignments.data ?? []).filter(
    (a) => a.status !== "offered" || a.expires_at > now,
  );
  return (
    <section className={styles.stack}>
      <PageHeading
        title="Schedule & availability"
        description="Working hours, dated exceptions, offer holds and confirmed work ? Asia/Manila"
      />
      <article className={styles.card}>
        <h2>Reserved work and offer holds</h2>
        {!blocks.length && !leadJobs.data?.length ? (
          <EmptyState
            title="No upcoming work blocks"
            description="MAZ assignment offers reserve a time slot until their deadline."
          />
        ) : (
          <ul className={styles.list}>
            {blocks.map((a) => (
              <li key={a.id}>
                <strong>
                  {a.trade} ?{" "}
                  {a.status === "offered"
                    ? "Offer hold"
                    : a.status === "withdrawal_requested"
                      ? "Replacement requested"
                      : "Accepted assignment"}
                </strong>
                <p>
                  {dayAndTime(a.starts_at)} to {dayAndTime(a.ends_at)}
                </p>
                {a.status !== "offered" ? (
                  <Link href={"/provider/jobs/" + a.booking_id}>
                    Open assignment
                  </Link>
                ) : (
                  <Link href="/provider/offers">Review offer</Link>
                )}
              </li>
            ))}
            {leadJobs.data?.map((j) => (
              <li key={j.id}>
                <Link href={"/provider/jobs/" + j.id}>
                  {j.services?.name ?? "Lead assignment"}
                </Link>
                <p>
                  {j.scheduled_start
                    ? dayAndTime(j.scheduled_start)
                    : "Awaiting confirmation"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </article>
      <div className={styles.grid}>
        <article className={styles.card}>
          <WeeklyHoursForm initial={weekly.data ?? []} />
        </article>
        <article className={styles.card}>
          <AvailabilityForm />
        </article>
      </div>
      <article className={styles.card}>
        <h2>Dated exceptions</h2>
        {!exceptions.data?.length ? (
          <p>No upcoming exceptions.</p>
        ) : (
          <ul className={styles.list}>
            {exceptions.data.map((e) => (
              <li key={e.id}>
                <strong>
                  {e.kind === "available" ? "Available" : "Unavailable"}
                </strong>
                <p>
                  {dayAndTime(e.starts_at)} to {dayAndTime(e.ends_at)}
                </p>
                <p>{e.note}</p>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
