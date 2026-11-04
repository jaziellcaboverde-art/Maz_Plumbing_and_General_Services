import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS } from "@/lib/booking/rules";
import { ReportsDashboard, type ReportsData } from "./reports-dashboard";

type Period = "30" | "90" | "year";
type Person = { first_name: string | null; last_name: string | null };
type Service = { name: string | null; category: string | null } | { name: string | null; category: string | null }[] | null;
type BookingRow = {
  id: string;
  status: string;
  created_at: string;
  is_urgent: boolean;
  provider_id: string | null;
  picked_provider_id: string | null;
  services: Service;
};
type PaymentRow = {
  amount: number;
  refunded_amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
};
type ReviewRow = { provider_id: string; stars: number; created_at: string };
type ProviderRow = {
  profile_id: string;
  profiles: Person | Person[] | null;
};

const PAGE_SIZE = 1000;

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  await connection();
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") redirect("/customer");

  const params = await searchParams;
  const requestedPeriod = Array.isArray(params.period) ? params.period[0] : params.period;
  const period: Period = requestedPeriod === "90" || requestedPeriod === "year" ? requestedPeriod : "30";
  const now = new Date();
  const range = getDateRange(period, now);
  const admin = createAdminClient();

  const [bookingsResult, paymentsResult, reviewsResult, providersResult] = await Promise.all([
    readPages<BookingRow>((from, to) => admin.from("bookings")
      .select("id,status,created_at,is_urgent,provider_id,picked_provider_id,services:services!bookings_service_id_fkey(name,category)")
      .gte("created_at", range.start.toISOString())
      .lt("created_at", range.end.toISOString())
      .order("created_at", { ascending: true })
      .range(from, to)),
    readPages<PaymentRow>((from, to) => admin.from("payments")
      .select("amount,refunded_amount,status,created_at,paid_at")
      .or(`and(paid_at.gte.${range.start.toISOString()},paid_at.lt.${range.end.toISOString()}),and(created_at.gte.${range.start.toISOString()},created_at.lt.${range.end.toISOString()})`)
      .order("created_at", { ascending: true })
      .range(from, to)),
    readPages<ReviewRow>((from, to) => admin.from("reviews")
      .select("provider_id,stars,created_at")
      .eq("hidden", false)
      .gte("created_at", range.start.toISOString())
      .lt("created_at", range.end.toISOString())
      .order("created_at", { ascending: true })
      .range(from, to)),
    readPages<ProviderRow>((from, to) => admin.from("provider_profiles")
      .select("profile_id,profiles!provider_profiles_profile_id_fkey(first_name,last_name)")
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .range(from, to)),
  ]);

  const providerNames = new Map((providersResult.rows ?? []).map((provider) => [
    provider.profile_id,
    fullName(one(provider.profiles), "Provider"),
  ]));
  const serviceCounts = new Map<string, { name: string; category: string; bookings: number }>();
  const statusCounts = new Map<string, number>();
  const providerCounts = new Map<string, number>();
  let urgentBookings = 0;
  for (const booking of bookingsResult.rows ?? []) {
    statusCounts.set(booking.status, (statusCounts.get(booking.status) ?? 0) + 1);
    if (booking.is_urgent) urgentBookings += 1;
    const assignedProvider = booking.provider_id ?? booking.picked_provider_id;
    if (assignedProvider) providerCounts.set(assignedProvider, (providerCounts.get(assignedProvider) ?? 0) + 1);
    const service = one(booking.services);
    if (service?.name) {
      const current = serviceCounts.get(service.name) ?? {
        name: service.name,
        category: service.category ?? "Other",
        bookings: 0,
      };
      current.bookings += 1;
      serviceCounts.set(service.name, current);
    }
  }

  const reviewStats = new Map<string, { total: number; count: number }>();
  for (const review of reviewsResult.rows ?? []) {
    const current = reviewStats.get(review.provider_id) ?? { total: 0, count: 0 };
    current.total += review.stars;
    current.count += 1;
    reviewStats.set(review.provider_id, current);
  }

  const payments = paymentsResult.rows ?? [];
  const collected = payments.reduce((sum, payment) => {
    if (!payment.paid_at || payment.paid_at < range.start.toISOString() || payment.paid_at >= range.end.toISOString()) return sum;
    if (!["paid", "partially_refunded", "refunded"].includes(payment.status)) return sum;
    return sum + Number(payment.amount) - Number(payment.refunded_amount);
  }, 0);
  const refunded = payments.reduce((sum, payment) => {
    if (!payment.paid_at || payment.paid_at < range.start.toISOString() || payment.paid_at >= range.end.toISOString()) return sum;
    return sum + Number(payment.refunded_amount);
  }, 0);
  const pendingPayments = payments.filter((payment) => payment.status === "pending"
    && payment.created_at >= range.start.toISOString()
    && payment.created_at < range.end.toISOString());
  const bookingRows = bookingsResult.rows ?? [];
  const completedBookings = statusCounts.get("completed") ?? 0;
  const inProgressBookings = statusCounts.get("in_progress") ?? 0;

  const report: ReportsData = {
    period,
    rangeLabel: `${formatDate(range.start)} – ${formatDate(new Date(range.end.getTime() - 1))}`,
    summary: {
      totalBookings: bookingRows.length,
      completedBookings,
      inProgressBookings,
      urgentBookings,
    },
    payments: {
      collected,
      refunded,
      outstanding: pendingPayments.reduce((sum, payment) => sum + Number(payment.amount), 0),
      pendingCount: pendingPayments.length,
    },
    trend: createTrend(bookingRows, period, range.start, now),
    statuses: [...statusCounts.entries()]
      .map(([status, count]) => ({ status: STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? readable(status), count }))
      .sort((a, b) => b.count - a.count),
    providers: [...providerCounts.entries()]
      .map(([id, bookings]) => {
        const review = reviewStats.get(id);
        return {
          name: providerNames.get(id) ?? "Provider",
          bookings,
          averageRating: review?.count ? review.total / review.count : null,
          reviewCount: review?.count ?? 0,
        };
      })
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5),
    services: [...serviceCounts.values()].sort((a, b) => b.bookings - a.bookings).slice(0, 5),
  };
  const errors = [bookingsResult.error, paymentsResult.error, reviewsResult.error, providersResult.error]
    .filter((error): error is string => error !== null);

  return <ReportsDashboard data={report} loadErrors={errors} />;
}

async function readPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + PAGE_SIZE - 1);
    if (error) return { rows, error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { rows, error: null };
  }
}

function getDateRange(period: Period, now: Date) {
  const today = localDateKey(now);
  const startDay = new Date(`${today}T00:00:00Z`);
  if (period === "year") {
    startDay.setUTCMonth(0, 1);
  } else {
    startDay.setUTCDate(startDay.getUTCDate() - (period === "30" ? 29 : 89));
  }
  const date = startDay.toISOString().slice(0, 10);
  return {
    start: new Date(`${date}T00:00:00+08:00`),
    end: now,
  };
}

function createTrend(rows: BookingRow[], period: Period, start: Date, now: Date) {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const key = trendKey(new Date(row.created_at), period);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const keys: string[] = [];
  const cursor = new Date(`${localDateKey(start)}T00:00:00Z`);
  if (period === "year") cursor.setUTCDate(1);
  else if (period === "90") cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
  const last = new Date(`${localDateKey(now)}T00:00:00Z`);
  if (period === "year") last.setUTCDate(1);
  else if (period === "90") last.setUTCDate(last.getUTCDate() - ((last.getUTCDay() + 6) % 7));
  while (cursor <= last) {
    keys.push(trendKey(cursor, period));
    if (period === "year") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else if (period === "90") cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys.map((key) => ({ label: trendLabel(key, period), count: buckets.get(key) ?? 0 }));
}

function trendKey(date: Date, period: Period) {
  const day = localDateKey(date);
  if (period === "year") return day.slice(0, 7);
  if (period === "30") return day;
  const week = new Date(`${day}T00:00:00Z`);
  week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
  return week.toISOString().slice(0, 10);
}

function trendLabel(key: string, period: Period) {
  const date = new Date(`${key}${key.length === 7 ? "-01" : ""}T00:00:00Z`);
  if (period === "year") return new Intl.DateTimeFormat("en-PH", { month: "short", timeZone: "UTC" }).format(date);
  if (period === "30") return new Intl.DateTimeFormat("en-PH", { day: "numeric", timeZone: "UTC" }).format(date);
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function localDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function fullName(person: Person | null, fallback: string) {
  return [person?.first_name, person?.last_name].filter(Boolean).join(" ") || fallback;
}

function readable(value: string) {
  return value.replaceAll("_", " ");
}
