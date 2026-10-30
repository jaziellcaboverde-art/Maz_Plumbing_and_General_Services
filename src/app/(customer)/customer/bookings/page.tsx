import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { StatusBadge } from "@/components/booking/status-badge";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import {
  OFFICIAL_STATUSES, databaseStatusesFor, officialStatus, paymentStatusFor, statusFromSlug, statusSlug,
} from "@/lib/booking/official-status";
import { loadProviderSummaries } from "@/lib/booking/provider-summary";
import type { BookingStatus } from "@/lib/booking/rules";
import { dayAndTime } from "@/lib/matching/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export default function CustomerBookingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  return <Suspense fallback={<p role="status">Loading your bookings…</p>}><BookingsContent searchParams={searchParams} /></Suspense>;
}

type Row = {
  id: string;
  status: BookingStatus;
  description: string | null;
  preferred_start: string | null;
  is_urgent: boolean;
  created_at: string;
  provider_id: string | null;
  quote_total: number | null;
  services: { name: string } | null;
  payments: { amount: number; status: string }[] | null;
  cash_records: { amount: number }[] | null;
};

async function BookingsContent({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: statusParam } = await searchParams;
  const filter = statusFromSlug(statusParam);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/customer/bookings");

  let query = supabase
    .from("bookings")
    .select("id,status,description,preferred_start,is_urgent,created_at,provider_id,quote_total,services(name),payments(amount,status),cash_records(amount)")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });
  if (filter) query = query.in("status", databaseStatusesFor(filter));
  const { data, error } = await query.returns<Row[]>();
  const rows = data ?? [];
  const providers = await loadProviderSummaries(createAdminClient(), rows.flatMap((row) => (row.provider_id ? [row.provider_id] : [])));
  const newLink = <Link className={styles.primaryLink} href="/customer/bookings/new">Book a service</Link>;

  return (
    <section className={styles.page}>
      <PageHeading title="My Bookings" description="Your service requests and their status." trailing={newLink} />
      <nav className={styles.filters} aria-label="Filter by status">
        <Link className={styles.filter} href="/customer/bookings" aria-current={filter ? undefined : "page"}>All</Link>
        {OFFICIAL_STATUSES.map((status) => (
          <Link key={status} className={styles.filter} href={`/customer/bookings?status=${statusSlug(status)}`} aria-current={filter === status ? "page" : undefined}>{status}</Link>
        ))}
      </nav>
      {error && <p role="alert">Could not load your bookings: {error.message}. Refresh the page to try again.</p>}
      {!error && rows.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title={filter ? `No ${filter} bookings.` : "No bookings yet. Book a service."}
          description={filter ? "Choose another status above, or pick All." : "Pick a service, add your address and choose when you need us."}
          action={filter ? <Link className={styles.itemLink} href="/customer/bookings">Show all bookings</Link> : newLink}
        />
      )}
      {rows.length > 0 && (
        <ul className={styles.list}>
          {rows.map((row) => {
            const official = officialStatus(row.status);
            const href = row.status === "draft" ? `/customer/bookings/new?draft=${row.id}` : `/customer/bookings/${row.id}`;
            const paidTotal = (row.payments ?? []).filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + Number(payment.amount), 0)
              + (row.cash_records ?? []).reduce((sum, record) => sum + Number(record.amount), 0);
            const payment = paymentStatusFor({ status: row.status, quoteTotal: row.quote_total === null ? null : Number(row.quote_total), paidTotal });
            const provider = row.provider_id ? providers.get(row.provider_id) : undefined;
            return (
              <li key={row.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <h2 className={styles.itemTitle}>{row.services?.name ?? "Service not chosen yet"}</h2>
                  {official ? <StatusBadge status={official} /> : <span className={styles.draftNote}>Not submitted yet</span>}
                </div>
                {row.description && <p className={styles.itemText}>{row.description}</p>}
                <dl className={styles.facts}>
                  <div><dt>Date</dt><dd>{row.is_urgent ? "Urgent" : row.preferred_start ? dayAndTime(row.preferred_start) : "No date chosen"}</dd></div>
                  <div><dt>Provider</dt><dd>{provider ? provider.name : "Not assigned yet"}</dd></div>
                  {payment && <div><dt>Payment</dt><dd>{payment}</dd></div>}
                </dl>
                <Link className={styles.itemLink} href={href}>{row.status === "draft" ? "Continue this draft" : "View booking"}</Link>
              </li>
            );
          })}
        </ul>
      )}
      <p><Link className={styles.itemLink} href="/customer/bookings/history">Service history</Link></p>
    </section>
  );
}
