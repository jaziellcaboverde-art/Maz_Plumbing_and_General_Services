import Link from "next/link";
import { PageHeading } from "@/components/layout/page-heading";
import { StatusBadge } from "@/components/booking/status-badge";
import { OFFICIAL_STATUSES } from "@/lib/booking/official-status";
import { workflowSession } from "@/lib/workflow/session";
import { dayAndTime } from "@/lib/matching/format";
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
      "id,status,official_status,description,preferred_start,scheduled_start,created_at,services(name),profiles!bookings_customer_id_fkey(first_name,last_name)",
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
  const term = filters.q
    ?.trim()
    .replace(/[^\p{L}\p{N} -]/gu, "")
    .slice(0, 100);
  if (term) {
    if (/^[0-9a-f-]{36}$/i.test(term)) query = query.eq("id", term);
    else query = query.ilike("description", `%${term}%`);
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
        title="Managed bookings"
        description="Review requests, arrange teams and follow each project through financial closure."
        trailing={
          <Link href="/admin/create-booking">Create on behalf of customer</Link>
        }
      />
      <form className={`${styles.card} ${styles.form}`}>
        <label>
          Description or full booking ID
          <input name="q" defaultValue={filters.q} />
        </label>
        <div className={styles.grid}>
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
            Submitted from
            <input name="from" type="date" defaultValue={filters.from} />
          </label>
          <label>
            Submitted through
            <input name="to" type="date" defaultValue={filters.to} />
          </label>
        </div>
        <button type="submit">Apply filters</button>
      </form>
      {error ? (
        <p role="alert">Could not load bookings.</p>
      ) : (
        <>
          <p>{count ?? 0} matching requests</p>
          <div className={styles.grid}>
            {data?.map((b) => {
              const service = Array.isArray(b.services)
                ? b.services[0]
                : b.services;
              const person = Array.isArray(b.profiles)
                ? b.profiles[0]
                : b.profiles;
              return (
                <article className={styles.card} key={b.id}>
                  <StatusBadge status={b.official_status} />
                  <h2>
                    <Link href={`/admin/bookings/${b.id}`}>
                      {service?.name ?? "Service request"} - {b.id.slice(0, 8)}
                    </Link>
                  </h2>
                  <p>
                    {person?.first_name} {person?.last_name}
                  </p>
                  <p>{b.description}</p>
                  <p>
                    Requested:{" "}
                    {b.preferred_start
                      ? dayAndTime(b.preferred_start)
                      : "Urgent; awaiting appointment"}
                  </p>
                  <p>
                    Confirmed:{" "}
                    {b.scheduled_start
                      ? dayAndTime(b.scheduled_start)
                      : "Not yet confirmed"}
                  </p>
                  <p>Operational step: {b.status.replaceAll("_", " ")}</p>
                </article>
              );
            })}
          </div>
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
