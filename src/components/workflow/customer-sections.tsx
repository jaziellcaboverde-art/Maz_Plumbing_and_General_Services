import { ActionLink } from "@/components/ui/action-link";
import Link from "next/link";
import { PageHeading } from "@/components/layout/page-heading";
import {
  PortalPanel,
  PortalStats,
  PortalTable,
} from "@/components/layout/portal";
import { Banknote, CreditCard, Receipt, Star } from "lucide-react";
import { StatusBadge } from "@/components/booking/status-badge";
import { workflowSession } from "@/lib/workflow/session";
import { dayAndTime, peso } from "@/lib/matching/format";
import styles from "./workflow.module.css";
import portal from "@/components/layout/portal.module.css";

export async function CustomerProjects() {
  const { client, user } = await workflowSession("customer");
  const { data, error } = await client
    .from("bookings")
    .select("id,official_status,services(name),milestones(id,title,status)")
    .eq("customer_id", user.id)
    .in("official_status", ["Assigned", "Ongoing", "Completed"])
    .order("updated_at", { ascending: false });
  return (
    <section className={styles.page}>
      <PageHeading
        title="My projects"
        description="Follow your team’s approved work and project checkpoints."
      />
      {error ? (
        <p role="alert">Could not load projects. Please refresh.</p>
      ) : !data?.length ? (
        <p className={portal.empty}>
          Projects appear here after MAZ confirms your team.
        </p>
      ) : (
        data.map((b) => {
          const service = Array.isArray(b.services)
            ? b.services[0]
            : b.services;
          const milestones = b.milestones ?? [];
          const progress = milestones.length
            ? Math.round(
                (milestones.filter((m) => m.status === "confirmed").length /
                  milestones.length) *
                  100,
              )
            : b.official_status === "Completed"
              ? 100
              : 0;
          return (
            <PortalPanel
              key={b.id}
              title={service?.name ?? "Service project"}
              action={<StatusBadge status={b.official_status} />}
            >
              <div className={portal.panelBody}>
                <div className={portal.progressRow}>
                  <span>Approved checkpoints</span>
                  <strong>{progress}%</strong>
                  <progress
                    value={progress}
                    max={100}
                    aria-label="Approved project progress"
                  />
                </div>
                {milestones.length ? (
                  <ul className={styles.list}>
                    {milestones.map((m) => (
                      <li key={m.id} className={styles.head}>
                        <strong>{m.title}</strong>
                        <span>
                          {m.status === "confirmed"
                            ? "Approved"
                            : m.status === "submitted"
                              ? "For MAZ review"
                              : "Pending"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>MAZ will share reviewed progress in your booking.</p>
                )}
                <ActionLink href={`/customer/bookings/${b.id}`}>
                  View project details
                </ActionLink>
              </div>
            </PortalPanel>
          );
        })
      )}
    </section>
  );
}

export async function CustomerPayments() {
  const { client, user } = await workflowSession("customer");
  const { data, error } = await client
    .from("bookings")
    .select(
      "id,quote_total,official_status,services(name),payments(amount,refunded_amount,status),cash_records(amount),receipts(number,amount,issued_at)",
    )
    .eq("customer_id", user.id)
    .neq("status", "draft")
    .order("updated_at", { ascending: false });
  if (error)
    return <p role="alert">Could not load payment records. Please refresh.</p>;
  const rows = (data ?? []).map((b) => {
    const service = Array.isArray(b.services) ? b.services[0] : b.services;
    const paid =
      (b.payments ?? [])
        .filter((p) => ["paid", "partially_refunded"].includes(p.status))
        .reduce(
          (sum, p) => sum + Number(p.amount) - Number(p.refunded_amount),
          0,
        ) +
      (b.cash_records ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    return {
      ...b,
      name: service?.name ?? "Service request",
      paid,
      remaining:
        b.quote_total == null || b.official_status === "Cancelled"
          ? 0
          : Math.max(0, Number(b.quote_total) - paid),
    };
  });
  return (
    <section className={styles.page}>
      <PageHeading
        title="Payments & receipts"
        description="Verified payments and project balances. Open a booking to view the amount currently due or make a payment."
      />
      <PortalStats
        items={[
          {
            label: "Remaining service balances",
            value: peso(rows.reduce((s, b) => s + b.remaining, 0)),
            href: "/customer/bookings",
            icon: CreditCard,
          },
          {
            label: "Verified payments",
            value: peso(rows.reduce((s, b) => s + b.paid, 0)),
            href: "/customer/payments",
            icon: Banknote,
            tone: "success",
          },
          {
            label: "Receipts",
            value: rows.reduce((s, b) => s + (b.receipts?.length ?? 0), 0),
            href: "/customer/payments#receipts",
            icon: Receipt,
          },
        ]}
      />
      <PortalTable
        label="Payment records"
        columns={[
          "Booking",
          "Service",
          "Approved total",
          "Verified paid",
          "Remaining",
          "Action",
        ]}
        rows={rows.map((b) => ({
          key: b.id,
          cells: [
            b.id.slice(0, 8),
            b.name,
            b.quote_total == null
              ? "Awaiting quotation"
              : peso(Number(b.quote_total)),
            peso(b.paid),
            b.official_status === "Cancelled"
              ? "Cancelled / MAZ review"
              : b.quote_total == null
                ? "Not yet quoted"
                : peso(b.remaining),
            <ActionLink key="action" href={`/customer/bookings/${b.id}`}>
              Open payment options
            </ActionLink>,
          ],
        }))}
      />
      <div id="receipts">
        <PortalPanel title="Payment receipts" icon={Receipt}>
          <PortalTable
            label="Receipts"
            columns={["Receipt", "Service", "Amount", "Issued"]}
            rows={rows.flatMap((b) =>
              (b.receipts ?? []).map((r) => ({
                key: r.number,
                cells: [
                  r.number,
                  b.name,
                  peso(Number(r.amount)),
                  dayAndTime(r.issued_at),
                ],
              })),
            )}
            empty="Receipts appear after MAZ verifies payment."
          />
        </PortalPanel>
      </div>
    </section>
  );
}

export async function CustomerReviews() {
  const { client, user } = await workflowSession("customer");
  const { data, error } = await client
    .from("bookings")
    .select("id,services(name),company_reviews(stars,comment,created_at)")
    .eq("customer_id", user.id)
    .eq("official_status", "Completed")
    .order("updated_at", { ascending: false });
  return (
    <section className={styles.page}>
      <PageHeading
        title="My reviews"
        description="Rate MAZ after completion. Worker feedback remains private and separate."
        trailing={<ActionLink href="/customer/profile">Edit profile</ActionLink>}
      />
      {error ? (
        <p role="alert">Could not load reviews. Please refresh.</p>
      ) : !data?.length ? (
        <p className={portal.empty}>Complete a service to leave your review.</p>
      ) : (
        data.map((b) => {
          const service = Array.isArray(b.services)
            ? b.services[0]
            : b.services;
          const review = Array.isArray(b.company_reviews)
            ? b.company_reviews[0]
            : b.company_reviews;
          return (
            <PortalPanel
              key={b.id}
              title={service?.name ?? "Completed service"}
              action={
                <Link href={`/customer/bookings/${b.id}`}>
                  {review ? "View or edit review" : "Write a review"}
                </Link>
              }
            >
              <div className={portal.panelBody}>
                {review ? (
                  <>
                    <div className={styles.actions}>
                      <Star aria-hidden="true" className={portal.statIcon} />
                      <strong>{review.stars}/5</strong>
                    </div>
                    <p>{review.comment}</p>
                  </>
                ) : (
                  <p>How was your service with MAZ?</p>
                )}
              </div>
            </PortalPanel>
          );
        })
      )}
    </section>
  );
}
