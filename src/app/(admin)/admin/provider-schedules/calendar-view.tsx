import Link from "next/link";
import { BookingCalendar } from "@/components/booking/booking-calendar";
import { addDays, now, weekFromParam, type CalendarBooking } from "@/lib/booking/calendar";
import type { BookingStatus } from "@/lib/booking/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import styles from "./page.module.css";

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
/** The steps a job goes through, in order. Each step counts the real bookings in those statuses. */
const STAGES: { key: string; label: string; statuses: BookingStatus[] }[] = [
  { key: "finding", label: "Finding a provider", statuses: ["open", "offered"] },
  { key: "quote", label: "Quote and deposit", statuses: ["accepted", "quoted"] },
  { key: "confirmed", label: "Confirmed", statuses: ["deposit_paid", "scheduled"] },
  { key: "progress", label: "In progress", statuses: ["on_the_way", "in_progress"] },
  { key: "finished", label: "Finished", statuses: ["done", "signed", "balance_paid", "completed"] },
];

const nameOf = (p: { first_name: string | null; last_name: string | null } | null, fallback: string) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(" ") || fallback;

type Row = {
  id: string; status: BookingStatus; provider_id: string | null; is_urgent: boolean;
  preferred_start: string | null; scheduled_start: string | null;
  services: { name: string } | { name: string }[] | null;
  customer: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
};

/** The week calendar inside Provider schedule: every provider's jobs, or one provider at a time. */
export async function ScheduleCalendarView({ week, provider, status }: { week?: string; provider?: string; status?: string }) {
  const current = now();
  const monday = weekFromParam(week, current.todayKey);
  const startAt = new Date(`${monday}T00:00:00+08:00`).toISOString();
  const endAt = new Date(`${addDays(monday, 7)}T00:00:00+08:00`).toISOString();

  const admin = createAdminClient();
  const [{ data: providerRows }, { data: bookingRows, error }, { data: statusRows }] = await Promise.all([
    admin.from("provider_profiles")
      .select("profile_id,profiles!provider_profiles_profile_id_fkey(first_name,last_name)")
      .eq("status", "approved").order("created_at", { ascending: true }).limit(500),
    admin.from("bookings")
      .select("id,status,provider_id,is_urgent,preferred_start,scheduled_start,services:services!bookings_service_id_fkey(name),customer:profiles!bookings_customer_id_fkey(first_name,last_name)")
      .not("status", "in", "(draft,cancelled)")
      .or(`and(scheduled_start.gte.${startAt},scheduled_start.lt.${endAt}),and(scheduled_start.is.null,preferred_start.gte.${startAt},preferred_start.lt.${endAt}),and(scheduled_start.is.null,preferred_start.is.null)`)
      .limit(1000)
      .returns<Row[]>(),
    // Every booking in the job process (not only this week), so the Status counts follow the real work.
    admin.from("bookings").select("status,provider_id").not("status", "in", "(draft,cancelled)").limit(5000)
      .returns<{ status: BookingStatus; provider_id: string | null }[]>(),
  ]);

  const providers = (providerRows ?? []).map((row) => ({
    id: row.profile_id as string,
    name: nameOf(one(row.profiles as never), "Provider"),
  }));
  const nameById = new Map(providers.map((p) => [p.id, p.name]));
  const wanted = provider && nameById.has(provider) ? provider : null;

  const stage = STAGES.find((item) => item.key === status) ?? null;
  const counts = STAGES.map((item) => ({
    ...item,
    count: (statusRows ?? []).filter((row) => item.statuses.includes(row.status) && (!wanted || row.provider_id === wanted)).length,
  }));

  const bookings: CalendarBooking[] = (bookingRows ?? [])
    .filter((row) => (wanted ? row.provider_id === wanted : true))
    .filter((row) => (stage ? stage.statuses.includes(row.status) : true))
    .map((row) => ({
      id: row.id, status: row.status, isUrgent: row.is_urgent,
      serviceName: one(row.services)?.name ?? "Service project",
      start: row.scheduled_start ?? row.preferred_start,
      subtitle: `${nameOf(one(row.customer), "Customer")} · ${row.provider_id ? `with ${nameById.get(row.provider_id) ?? "provider"}` : "needs a provider"}`,
      href: row.provider_id ? "/admin/bookings" : "/admin/assignments",
    }));

  const extra = `${wanted ? `&provider=${wanted}` : ""}${stage ? `&status=${stage.key}` : ""}`;
  const keep = `${stage ? `&status=${stage.key}` : ""}`;
  const keepProvider = `${wanted ? `&provider=${wanted}` : ""}`;
  const filter = (
    <div className={styles.filter}>
      <h2 className={styles.filterTitle}>Provider</h2>
      <ul className={styles.filterList}>
        <li><Link className={styles.filterLink} data-active={!wanted || undefined} href={`/admin/provider-schedules?week=${monday}${keep}`}>All providers</Link></li>
        {providers.map((p) => (
          <li key={p.id}><Link className={styles.filterLink} data-active={wanted === p.id || undefined} href={`/admin/provider-schedules?week=${monday}&provider=${p.id}${keep}`}>{p.name}</Link></li>
        ))}
      </ul>
    </div>
  );

  const statusCard = (
    <div className={styles.filter}>
      <h2 className={styles.filterTitle}>Status</h2>
      <ul className={styles.filterList}>
        <li><Link className={styles.statusLink} data-active={!stage || undefined} href={`/admin/provider-schedules?week=${monday}${keepProvider}`}><span className={styles.statusName}>All stages</span><span className={styles.statusCount}>{counts.reduce((sum, item) => sum + item.count, 0)}</span></Link></li>
        {counts.map((item) => (
          <li key={item.key}><Link className={styles.statusLink} data-active={stage?.key === item.key || undefined} href={`/admin/provider-schedules?week=${monday}${keepProvider}&status=${item.key}`}><span className={styles.statusName}><span className={styles.swatch} data-stage={item.key} aria-hidden="true" />{item.label}</span><span className={styles.statusCount}>{item.count}</span></Link></li>
        ))}
      </ul>
    </div>
  );

  return <>
    {error && <p role="alert">Could not load the calendar: {error.message}. Refresh the page to try again.</p>}
    <BookingCalendar
      bookings={bookings} monday={monday} todayKey={current.todayKey} nowIso={current.iso}
      basePath="/admin/provider-schedules" extraParams={extra} sideTop={filter} statusCard={statusCard} noTimeTitle="No time set or no provider"
    />
  </>;
}
