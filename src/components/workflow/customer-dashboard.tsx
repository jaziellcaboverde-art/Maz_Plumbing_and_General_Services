import Link from "next/link";
import {
  CalendarDays,
  ClipboardCheck,
  BriefcaseBusiness,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { PageHeading } from "@/components/layout/page-heading";
import { StatusBadge } from "@/components/booking/status-badge";
import { workflowSession } from "@/lib/workflow/session";
import { dayAndTime } from "@/lib/matching/format";
import icons from "@/components/ui/icon-size.module.css";
import styles from "./workflow.module.css";
export async function CustomerDashboard() {
  const { client, user, profile } = await workflowSession("customer");
  const [bookings, quotes, documents, appointments, notifications] =
    await Promise.all([
      client
        .from("bookings")
        .select(
          "id,status,official_status,scheduled_start,schedule_confirmed_at,preferred_start,quote_total,services(name),payments(amount,refunded_amount,status),cash_records(amount)",
        )
        .eq("customer_id", user.id)
        .neq("status", "draft")
        .order("updated_at", { ascending: false }),
      client
        .from("quotes")
        .select("id,booking_id")
        .eq("status", "approved")
        .gt("expires_at", new Date().toISOString()),
      client
        .from("project_documents")
        .select("id,booking_id")
        .eq("status", "issued"),
      client
        .from("provider_appointment_requests")
        .select("id,booking_id")
        .eq("status", "pending")
        .gt("starts_at", new Date().toISOString()),
      client
        .from("notifications")
        .select("id,title,link,created_at")
        .eq("profile_id", user.id)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
  if (
    [bookings, quotes, documents, appointments, notifications].some(
      (r) => r.error,
    )
  )
    return (
      <p role="alert">
        Could not load your dashboard. Please refresh or contact MAZ.
      </p>
    );
  const rows = bookings.data ?? [];
  const active = rows.filter(
    (b) => !["Completed", "Cancelled"].includes(b.official_status),
  );
  const upcoming = active
    .filter(
      (b) =>
        b.schedule_confirmed_at &&
        b.scheduled_start &&
        new Date(b.scheduled_start) >= new Date(),
    )
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
  const approvals = [
    ...(quotes.data ?? []),
    ...(documents.data ?? []),
    ...(appointments.data ?? []),
  ];
  const balances = rows.filter(
    (b) =>
      b.quote_total != null &&
      Number(b.quote_total) >
        (b.payments ?? [])
          .filter((p) => ["paid", "partially_refunded"].includes(p.status))
          .reduce(
            (sum, p) => sum + Number(p.amount) - Number(p.refunded_amount),
            0,
          ) +
          (b.cash_records ?? []).reduce((sum, p) => sum + Number(p.amount), 0),
  );
  const metrics = [
    {
      label: "Confirmed upcoming appointments",
      value: upcoming.length,
      href: "/customer/bookings",
      Icon: CalendarDays,
    },
    {
      label: "Pending approvals",
      value: approvals.length,
      href: approvals[0]
        ? `/customer/bookings/${approvals[0].booking_id}`
        : "/customer/bookings",
      Icon: ClipboardCheck,
    },
    {
      label: "Active requests and projects",
      value: active.length,
      href: "/customer/bookings",
      Icon: BriefcaseBusiness,
    },
    {
      label: "Bookings with a remaining balance",
      value: balances.length,
      href: "/customer/bookings",
      Icon: Wallet,
    },
  ];
  return (
    <section className={styles.page}>
      <PageHeading
        title={`Welcome${profile.first_name ? `, ${profile.first_name}` : ""}`}
        description="MAZ manages your service, appointment, team and payments."
        trailing={<Link href="/customer/bookings/new">Request a service</Link>}
      />
      <div className={styles.grid}>
        {metrics.map(({ label, value, href, Icon }) => (
          <Link href={href} className={styles.card} key={label}>
            <span className={styles.actions}>
              <Icon className={icons.md} aria-hidden="true" />
              {label}
            </span>
            <strong className={styles.amount}>{value}</strong>
            <span className={styles.actions}>
              View details{" "}
              <ArrowRight className={icons.sm} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
      <article className={styles.card}>
        <h2>Your next step</h2>
        <p>
          {approvals.length
            ? "Review the quotation, contract or appointment waiting for your decision."
            : active.length
              ? "Follow your active booking for MAZ updates, confirmed dates and reviewed progress."
              : "Choose a service and submit a request. MAZ will assess it before confirming an appointment."}
        </p>
        {upcoming[0]?.scheduled_start && (
          <p>
            Next confirmed appointment:{" "}
            {dayAndTime(upcoming[0].scheduled_start)} (Philippine time).
          </p>
        )}
      </article>
      <h2>Recent bookings</h2>
      {!rows.length ? (
        <article className={styles.card}>
          <p>No service requests yet.</p>
          <Link href="/customer/bookings/new">Create your first request</Link>
        </article>
      ) : (
        <ul className={styles.list}>
          {rows.slice(0, 6).map((b) => {
            const service = Array.isArray(b.services)
              ? b.services[0]
              : b.services;
            return (
              <li className={styles.card} key={b.id}>
                <div className={styles.head}>
                  <strong>{service?.name ?? "Service request"}</strong>
                  <StatusBadge status={b.official_status} />
                </div>
                <p>
                  {b.schedule_confirmed_at && b.scheduled_start
                    ? `Confirmed: ${dayAndTime(b.scheduled_start)}`
                    : "Appointment awaiting MAZ confirmation"}
                </p>
                <Link href={`/customer/bookings/${b.id}`}>Open booking</Link>
              </li>
            );
          })}
        </ul>
      )}
      <h2>Recent notifications</h2>
      {!notifications.data?.length ? (
        <p>No unread notifications.</p>
      ) : (
        <ul className={styles.list}>
          {notifications.data.map((n) => (
            <li className={styles.card} key={n.id}>
              <strong>{n.title}</strong>
              <Link
                href={
                  n.link?.startsWith("/") && !n.link.startsWith("//")
                    ? n.link
                    : "/customer/notifications"
                }
              >
                Read update
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <Link href="/customer/services">Browse MAZ services</Link>
        <Link href="/customer/bookings/history">Service history</Link>
        <Link href="/customer/profile">Your profile</Link>
      </div>
    </section>
  );
}
