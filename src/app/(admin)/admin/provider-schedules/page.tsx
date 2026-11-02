import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ProviderScheduleBoard, type ScheduleBooking, type ScheduleProvider } from "./schedule-board";
import styles from "./page.module.css";

type Props = {
  searchParams: Promise<{ week?: string | string[] }>;
};

export default async function ProviderSchedulesPage({ searchParams }: Props) {
  await connection();
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") redirect("/customer");

  const params = await searchParams;
  const requestedWeek = Array.isArray(params.week) ? params.week[0] : params.week;
  const weekStart = getWeekStart(requestedWeek);
  const dayKeys = Array.from({ length: 14 }, (_, index) => addDays(weekStart, index))
    .filter((day) => {
      const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
      return weekday >= 1 && weekday <= 5;
    });
  const startAt = new Date(`${weekStart}T00:00:00+08:00`).toISOString();
  const endAt = new Date(`${addDays(weekStart, 14)}T00:00:00+08:00`).toISOString();

  const admin = createAdminClient();
  const [{ data: providerRows, error: providerError }, { data: bookingRows, error: bookingError }] = await Promise.all([
    admin.from("provider_profiles")
      .select("profile_id,profiles!provider_profiles_profile_id_fkey(first_name,last_name)")
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .limit(500),
    admin.from("bookings")
      .select("id,provider_id,preferred_start,status,services:services!bookings_service_id_fkey(name),customer:profiles!bookings_customer_id_fkey(first_name,last_name)")
      .gte("preferred_start", startAt)
      .lt("preferred_start", endAt)
      .not("status", "in", "(completed,cancelled)")
      .order("preferred_start", { ascending: true })
      .limit(1000),
  ]);

  const providers: ScheduleProvider[] = (providerRows ?? []).map((row) => {
    const profile = one(row.profiles);
    return {
      id: row.profile_id,
      name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Provider",
      bookings: [],
    };
  });
  const providersById = new Map(providers.map((provider) => [provider.id, provider]));
  const bookings: ScheduleBooking[] = (bookingRows ?? []).flatMap((row) => {
    if (!row.preferred_start) return [];
    const provider = row.provider_id ? providersById.get(row.provider_id) : null;
    const customer = one(row.customer);
    const service = one(row.services);
    const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(row.preferred_start));
    if (!dayKeys.includes(dayKey)) return [];
    const booking: ScheduleBooking = {
      id: row.id,
      dayKey,
      startsAt: row.preferred_start,
      customer: [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer",
      service: service?.name || "Service project",
      status: row.status,
    };
    if (provider) provider.bookings.push(booking);
    else booking.attention = row.provider_id ? "Assigned provider is not active" : "Needs a provider";
    return [booking];
  });

  return <section className={styles.page}>
    {(providerError || bookingError) && <p role="alert">Could not load the full schedule: {(providerError ?? bookingError)?.message}</p>}
    <ProviderScheduleBoard key={weekStart} providers={providers} attention={bookings.filter((booking) => Boolean(booking.attention))} weekStart={weekStart} dayKeys={dayKeys} />
  </section>;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function getWeekStart(value?: string): string {
  let date: Date;
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    date = new Date(Date.UTC(year, month - 1, day));
    if (date.toISOString().slice(0, 10) !== value) return getWeekStart();
  } else {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "0";
    date = new Date(Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day"))));
  }
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
