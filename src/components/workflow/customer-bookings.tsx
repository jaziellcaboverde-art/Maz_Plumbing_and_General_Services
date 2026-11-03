import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageHeading } from "@/components/layout/page-heading";
import { StatusBadge } from "@/components/booking/status-badge";
import { OFFICIAL_STATUSES } from "@/lib/booking/official-status";
import { workflowSession } from "@/lib/workflow/session";
import { dayAndTime } from "@/lib/matching/format";
import styles from "./workflow.module.css";
export async function CustomerBookings({
  filters = {},
  history = false,
}: {
  filters?: { status?: string; q?: string; from?: string; to?: string };
  history?: boolean;
}) {
  const { client, user } = await workflowSession("customer");
  let query = client
    .from("bookings")
    .select(
      "id,status,official_status,description,preferred_start,scheduled_start,schedule_confirmed_at,created_at,services(name)",
    )
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });
  if (history) query = query.eq("official_status", "Completed");
  else if (
    OFFICIAL_STATUSES.some(
      (s) => s.toLowerCase() === filters.status?.toLowerCase(),
    )
  )
    query = query.eq(
      "official_status",
      OFFICIAL_STATUSES.find(
        (s) => s.toLowerCase() === filters.status?.toLowerCase(),
      )!,
    );
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from))
    query = query.gte("created_at", `${filters.from}T00:00:00+08:00`);
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to))
    query = query.lte("created_at", `${filters.to}T23:59:59+08:00`);
  const { data, error } = await query;
  const rows = (data ?? []).filter(
    (b) =>
      !filters.q ||
      `${b.description} ${JSON.stringify(b.services)} ${b.id}`
        .toLowerCase()
        .includes(filters.q.toLowerCase()),
  );
  return (
    <section className={styles.page}>
      <PageHeading
        title={history ? "Service history" : "My bookings"}
        description={
          history
            ? "MAZ-verified completed work, payment acknowledgments and your reviews."
            : "Requested times and confirmed appointments are shown separately."
        }
        trailing={<Link href="/customer/bookings/new">Request a service</Link>}
      />
      <form className={`${styles.card} ${styles.form} ${styles.filters}`}>
        <label>
          Search bookings
          <input name="q" defaultValue={filters.q} />
        </label>
        {!history && (
          <label>
            Status
            <select name="status" defaultValue={filters.status ?? ""}>
              <option value="">All statuses</option>
              {OFFICIAL_STATUSES.map((s) => (
                <option key={s} value={s.toLowerCase()}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className={styles.filterFields}>
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
          <Button type="submit">Apply filters</Button>
          <Link href={history ? "/customer/history" : "/customer/bookings"}>
            Clear
          </Link>
        </div>
      </form>
      {error ? (
        <p role="alert">Your bookings could not be loaded.</p>
      ) : !rows.length ? (
        <p>No bookings match these filters.</p>
      ) : (
        <ul className={styles.list}>
          {rows.map((b) => {
            const service = Array.isArray(b.services)
              ? b.services[0]
              : b.services;
            return (
              <li className={styles.card} key={b.id}>
                <div className={styles.head}>
                  <h2>{service?.name ?? "Draft service request"}</h2>
                  {b.status === "draft" ? (
                    <span>Draft</span>
                  ) : (
                    <StatusBadge status={b.official_status} />
                  )}
                </div>
                <p>Reference {b.id.slice(0, 8)}</p>
                <p>{b.description}</p>
                <p>
                  Requested:{" "}
                  {b.preferred_start
                    ? dayAndTime(b.preferred_start)
                    : "Urgent / time to be agreed"}
                </p>
                <p>
                  Confirmed:{" "}
                  {b.schedule_confirmed_at && b.scheduled_start
                    ? dayAndTime(b.scheduled_start)
                    : "Not yet confirmed by MAZ"}
                </p>
                <Link
                  href={
                    b.status === "draft"
                      ? `/customer/bookings/new?draft=${b.id}`
                      : `/customer/bookings/${b.id}`
                  }
                >
                  {b.status === "draft"
                    ? "Continue draft"
                    : "Open booking and next actions"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Link
        href={history ? "/customer/bookings" : "/customer/bookings/history"}
      >
        {history ? "All bookings" : "Completed service history"}
      </Link>
    </section>
  );
}
