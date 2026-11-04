
import { AutoFilterForm } from "@/components/ui/auto-filter-form";
import { bookingSearchTerm, customerNameFilter } from "@/lib/booking/admin-search";
import { LinkButton } from "@/components/ui/link-button";
import { DataTable } from "@/components/ui/data-table";
import Link from "next/link";
import { PageHeading } from "@/components/layout/page-heading";
import { StatusBadge } from "@/components/booking/status-badge";
import { OFFICIAL_STATUSES } from "@/lib/booking/official-status";
import { workflowSession } from "@/lib/workflow/session";
import { dayAndTime, peso } from "@/lib/matching/format";
import styles from "./workflow.module.css";
export type BookingFilters = {
  status?: string;
  q?: string;
  page?: string;
  from?: string;
  to?: string;
};
export async function AdminBookings({
  filters = {},
}: {
  filters?: BookingFilters;
}) {
  const { client } = await workflowSession("admin");
  const page = Math.max(
    1,
    Math.min(100000, Math.floor(Number(filters.page) || 1)),
  );
  let query = client
    .from("bookings")
    .select(
      "id,status,official_status,description,manual_customer_name,preferred_start,scheduled_start,created_at,quote_total,payments(amount,refunded_amount,status),cash_records(amount),services(name),profiles!bookings_customer_id_fkey(first_name,last_name)",
      { count: "exact" },
    )
    .neq("status", "draft")
    .order("created_at", { ascending: false });
  if (
    OFFICIAL_STATUSES.includes(
      filters.status as (typeof OFFICIAL_STATUSES)[number],
    )
  )
    query = query.eq("official_status", filters.status!);
  const term = bookingSearchTerm(filters.q);
  let customerSearchError = false;
  if (term) {
    if (/^[0-9a-f-]{36}$/i.test(term)) query = query.eq("id", term);
    else {
      const customerIds: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const matches = await client.from("profiles").select("id")
          .or(customerNameFilter(term)).order("id").range(offset, offset + 999);
        if (matches.error) { customerSearchError = true; break; }
        customerIds.push(...(matches.data ?? []).map((person) => person.id));
        if ((matches.data?.length ?? 0) < 1000) break;
      }
      query = customerIds.length
        ? query.or(`description.ilike.%${term}%,manual_customer_name.ilike.%${term}%,customer_id.in.(${customerIds.join(",")})`)
        : query.or(`description.ilike.%${term}%,manual_customer_name.ilike.%${term}%`);
    }
  }
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from))
    query = query.gte("created_at", `${filters.from}T00:00:00+08:00`);
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to))
    query = query.lte("created_at", `${filters.to}T23:59:59+08:00`);
  const { data, error, count } = await query.range(
    (page - 1) * 30,
    page * 30 - 1,
  );
  const url = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, page: String(p) }))
      if (v) q.set(k, v);
    return `/admin/bookings?${q}`;
  };
  return (
    <section className={styles.page}>
      <PageHeading
        title="Bookings"
        description="Review requests and manage projects."
        trailing={
          <LinkButton variant="primary" href="/admin/create-booking">
            Create booking
          </LinkButton>
        }
      />
      <AutoFilterForm action="/admin/bookings" label="Booking filters" className={`${styles.card} ${styles.form} ${styles.filters}`}>
        <label>
          Customer, description or booking ID
          <input name="q" type="search" placeholder="Customer name, concern or booking ID" defaultValue={filters.q} />
        </label>
        <div className={styles.filterFields}>
          <label>
            Official status
            <select name="status" defaultValue={filters.status ?? ""}>
              <option value="">All</option>
              {OFFICIAL_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            From date
            <input name="from" type="date" defaultValue={filters.from} />
          </label>
          <label>
            To date
            <input name="to" type="date" defaultValue={filters.to} />
          </label>
        </div>
        <div className={styles.actions}>
          <LinkButton href="/admin/bookings">Clear</LinkButton>
        </div>
      </AutoFilterForm>
      {error || customerSearchError ? (
        <p role="alert">Could not load bookings.</p>
      ) : (
        <>
          <p>{count ?? 0} matching requests</p>
          <DataTable
            caption="Customer bookings"
            rows={data ?? []}
            getRowKey={(b) => b.id}
            columns={[
              {
                key: "service",
                header: "Service",
                render: (b) => {
                  const service = Array.isArray(b.services)
                    ? b.services[0]
                    : b.services;
                  return (
                    <>
                      <Link href={`/admin/bookings/${b.id}`}>
                        {service?.name ?? "Service request"}
                      </Link>
                      <span className={styles.reference}>
                        {b.id.slice(0, 8)}
                      </span>
                    </>
                  );
                },
              },
              {
                key: "customer",
                header: "Customer",
                render: (b) => {
                  const person = Array.isArray(b.profiles)
                    ? b.profiles[0]
                    : b.profiles;
                  return (
                    b.manual_customer_name || `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim() ||
                    "Customer"
                  );
                },
              },
              {
                key: "status",
                header: "Status",
                render: (b) => <StatusBadge status={b.official_status} />,
              },
              {
                key: "date",
                header: "Preferred date",
                render: (b) =>
                  b.preferred_start
                    ? dayAndTime(b.preferred_start)
                    : "To be agreed",
              },
              {
                key: "balance",
                header: "Balance",
                numeric: true,
                render: (b) => {
                  if (b.quote_total == null) return "Awaiting quote";
                  const paid =
                    (b.payments ?? [])
                      .filter((p) =>
                        ["paid", "partially_refunded"].includes(p.status),
                      )
                      .reduce(
                        (sum, p) =>
                          sum + Number(p.amount) - Number(p.refunded_amount),
                        0,
                      ) +
                    (b.cash_records ?? []).reduce(
                      (sum, p) => sum + Number(p.amount),
                      0,
                    );
                  return peso(Math.max(0, Number(b.quote_total) - paid));
                },
              },
              {
                key: "open",
                header: "Open",
                render: (b) => (
                  <LinkButton
                    href={`/admin/bookings/${b.id}`}
                    aria-label={`Open booking ${b.id.slice(0, 8)}`}
                  >
                    Open
                  </LinkButton>
                ),
              },
            ]}
          />
          <nav className={styles.actions} aria-label="Booking pages">
            {page > 1 && <Link href={url(page - 1)}>Previous page</Link>}
            <span>Page {page}</span>
            {page * 30 < (count ?? 0) && (
              <Link href={url(page + 1)}>Next page</Link>
            )}
          </nav>
        </>
      )}
    </section>
  );
}
