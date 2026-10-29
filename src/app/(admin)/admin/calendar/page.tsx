import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { BookingCalendar } from "@/components/booking/booking-calendar";
import { PageHeading } from "@/components/layout/page-heading";
import { addDays, now, weekFromParam, type CalendarBooking } from "@/lib/booking/calendar";
import type { BookingStatus } from "@/lib/booking/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import styles from "./calendar.module.css";

type Params = { week?: string | string[]; provider?: string | string[] };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const nameOf = (p: { first_name: string | null; last_name: string | null } | null, fallback: string) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(" ") || fallback;

type Row = {
  id: string; status: BookingStatus; provider_id: string | null; is_urgent: boolean;
  preferred_start: string | null; scheduled_start: string | null;
  services: { name: string } | { name: string }[] | null;
  customer: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
};

/** The admin's week calendar: every provider's jobs, or one provider at a time. */
export default async function AdminCalendarPage({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") redirect("/customer");

  const params = await searchParams;
  const current = now();
  const monday = weekFromParam(first(params.week), current.todayKey);
  const providerId = first(params.provider);
  const startAt = new Date(`${monday}T00:00:00+08:00`).toISOString();
  const endAt = new Date(`${addDays(monday, 7)}T00:00:00+08:00`).toISOString();

  const admin = createAdminClient();
  const [{ data: providerRows }, { data: bookingRows, error }] = await Promise.all([
    admin.from("provider_profiles")
      .select("profile_id,profiles!provider_profiles_profile_id_fkey(first_name,last_name)")
      .eq("status", "approved").order("created_at", { ascending: true }).limit(500),
    admin.from("bookings")
      .select("id,status,provider_id,is_urgent,preferred_start,scheduled_start,services:services!bookings_service_id_fkey(name),customer:profiles!bookings_customer_id_fkey(first_name,last_name)")
      .not("status", "in", "(draft,cancelled)")
      .or(`and(scheduled_start.gte.${startAt},scheduled_start.lt.${endAt}),and(scheduled_start.is.null,preferred_start.gte.${startAt},preferred_start.lt.${endAt}),and(scheduled_start.is.null,preferred_start.is.null)`)
      .limit(1000)
      .returns<Row[]>(),
  ]);

  const providers = (providerRows ?? []).map((row) => ({
    id: row.profile_id as string,
    name: nameOf(one(row.profiles as never), "Provider"),
  }));
  const nameById = new Map(providers.map((p) => [p.id, p.name]));
  const wanted = providerId && nameById.has(providerId) ? providerId : null;

  const bookings: CalendarBooking[] = (bookingRows ?? [])
    .filter((row) => (wanted ? row.provider_id === wanted : true))
    .map((row) => ({
      id: row.id, status: row.status, isUrgent: row.is_urgent,
      serviceName: one(row.services)?.name ?? "Service project",
      start: row.scheduled_start ?? row.preferred_start,
      subtitle: `${nameOf(one(row.customer), "Customer")} · ${row.provider_id ? `with ${nameById.get(row.provider_id) ?? "provider"}` : "needs a provider"}`,
      href: row.provider_id ? "/admin/bookings" : "/admin/assignments",
    }));

  const extra = wanted ? `&provider=${wanted}` : "";
  const filter = (
    <div className={styles.filter}>
      <h2 className={styles.filterTitle}>Provider</h2>
      <ul className={styles.filterList}>
        <li><Link className={styles.filterLink} data-active={!wanted || undefined} href={`/admin/calendar?week=${monday}`}>All providers</Link></li>
        {providers.map((p) => (
          <li key={p.id}><Link className={styles.filterLink} data-active={wanted === p.id || undefined} href={`/admin/calendar?week=${monday}&provider=${p.id}`}>{p.name}</Link></li>
        ))}
      </ul>
    </div>
  );

  return (
    <section className={styles.page}>
      <PageHeading title="Calendar" description="Track every provider's jobs by week. Pick a provider to see only their schedule." />
      {error && <p role="alert">Could not load the calendar: {error.message}. Refresh the page to try again.</p>}
      <BookingCalendar
        bookings={bookings} monday={monday} todayKey={current.todayKey} nowIso={current.iso}
        basePath="/admin/calendar" extraParams={extra} sideTop={filter} noTimeTitle="No time set or no provider"
      />
    </section>
  );
}
