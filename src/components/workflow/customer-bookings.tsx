import { ActionLink } from "@/components/ui/action-link";
import { PortalTable, PortalTabs } from "@/components/layout/portal";
import portal from "@/components/layout/portal.module.css";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/layout/page-heading";
import { StatusBadge } from "@/components/booking/status-badge";
import { OFFICIAL_STATUSES } from "@/lib/booking/official-status";
import { workflowSession } from "@/lib/workflow/session";
import { dayAndTime } from "@/lib/matching/format";
import styles from "./workflow.module.css";
import { CompanyReviewForm } from "./company-review-form";
import filtersStyle from "./booking-filters.module.css";
import { Search, SlidersHorizontal, Star } from "lucide-react";
import Form from "next/form";
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
      "id,status,official_status,description,preferred_start,scheduled_start,schedule_confirmed_at,created_at,services(name),company_reviews(stars,comment,created_at,publish,attribution)",
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
      />
      {!history && (
        <PortalTabs
          label="Booking status"
          items={[
            {
              label: "All",
              href: "/customer/bookings",
              active: !filters.status,
            },
            ...OFFICIAL_STATUSES.map((status) => {
              const params = new URLSearchParams();
              if (filters.q) params.set("q", filters.q);
              if (filters.from) params.set("from", filters.from);
              if (filters.to) params.set("to", filters.to);
              params.set("status", status);
              return {
                label: status,
                href: "/customer/bookings" + "?" + params.toString(),
                active: filters.status?.toLowerCase() === status.toLowerCase(),
              };
            }),
          ]}
        />
      )}
      <Form
        key={JSON.stringify(filters)}
        action={history ? "/customer/history" : "/customer/bookings"}
        className={`${styles.card} ${styles.form} ${filtersStyle.filters}`}
        aria-label="Booking filters"
      >
        <label>
          <span>
            <Search aria-hidden="true" className={styles.sectionIcon} />
            Search bookings
          </span>
          <input
            name="q"
            type="search"
            placeholder="Service, concern or booking ID"
            defaultValue={filters.q}
          />
        </label>
        {!history && (
          <div className={styles.field}>
            <label htmlFor="booking-filter-status">Status</label>
            <select
              id="booking-filter-status"
              name="status"
              defaultValue={filters.status?.toLowerCase() ?? ""}
            >
              <option value="">All statuses</option>
              {OFFICIAL_STATUSES.map((s) => (
                <option key={s} value={s.toLowerCase()}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
        <label>
          From date
          <input name="from" type="date" defaultValue={filters.from} />
        </label>
        <label>
          To date
          <input name="to" type="date" defaultValue={filters.to} />
        </label>
        <div className={filtersStyle.actions}>
          <Button type="submit" variant="primary">
            <SlidersHorizontal
              aria-hidden="true"
              className={styles.sectionIcon}
            />
            Apply filters
          </Button>
          <ActionLink
            href={history ? "/customer/history" : "/customer/bookings"}
          >
            Clear
          </ActionLink>
        </div>
      </Form>
      {error ? (
        <p role="alert">Your bookings could not be loaded.</p>
      ) : !rows.length ? (
        <p>No bookings match these filters.</p>
      ) : (
        <PortalTable
          label={history ? "Service history" : "My bookings"}
          columns={["Booking", "Service", "Schedule", "Status", "Action"]}
          rows={rows.map((b) => {
            const service = Array.isArray(b.services)
              ? b.services[0]
              : b.services;
            return {
              key: b.id,
              cells: [
                <strong key="ref">BK-{b.id.slice(0, 8)}</strong>,
                <div className={portal.cellStack} key="service">
                  <strong>{service?.name ?? "Service request"}</strong>
                  <small>{b.description}</small>
                </div>,
                <div className={portal.cellStack} key="schedule">
                  <span>
                    Requested:{" "}
                    {b.preferred_start
                      ? dayAndTime(b.preferred_start)
                      : "Urgent / to be agreed"}
                  </span>
                  <small>
                    Confirmed:{" "}
                    {b.schedule_confirmed_at && b.scheduled_start
                      ? dayAndTime(b.scheduled_start)
                      : "Not confirmed"}
                  </small>
                </div>,
                b.status === "draft" ? (
                  <span key="draft">Draft</span>
                ) : (
                  <StatusBadge key="status" status={b.official_status} />
                ),
                <ActionLink
                  key="action"
                  href={
                    b.status === "draft"
                      ? "/customer/bookings/new?draft=" + b.id
                      : "/customer/bookings/" + b.id
                  }
                >
                  {b.status === "draft" ? "Continue draft" : "View booking"}
                </ActionLink>,
              ],
            };
          })}
        />
      )}
      {history && !error && (
        <section
          id="reviews"
          className={styles.page}
          aria-labelledby="service-reviews-title"
        >
          <h2 id="service-reviews-title">
            <Star aria-hidden="true" className={styles.sectionIcon} />
            Service reviews
          </h2>
          {!rows.length ? (
            <p>
              Reviews become available after MAZ confirms service completion.
            </p>
          ) : (
            rows.map((b) => {
              const review = Array.isArray(b.company_reviews)
                ? b.company_reviews[0]
                : b.company_reviews;
              const service = Array.isArray(b.services)
                ? b.services[0]
                : b.services;
              return (
                <article className={styles.card} key={b.id}>
                  <div className={styles.head}>
                    <h3>{service?.name ?? "Completed service"}</h3>
                    <small>BK-{b.id.slice(0, 8)}</small>
                  </div>
                  {review && (
                    <p>
                      <strong>{review.stars}/5</strong>
                      {review.comment ? ` — ${review.comment}` : ""}
                    </p>
                  )}
                  <details className={filtersStyle.review}>
                    <summary>
                      {review ? "View or edit review" : "Write a review"}
                    </summary>
                    <CompanyReviewForm bookingId={b.id} review={review} />
                  </details>
                </article>
              );
            })
          )}
        </section>
      )}
      <ActionLink href={history ? "/customer/bookings" : "/customer/history"}>
        {history ? "All bookings" : "Completed service history"}
      </ActionLink>
    </section>
  );
}
