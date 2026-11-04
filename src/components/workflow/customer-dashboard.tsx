import { ActionLink } from "@/components/ui/action-link";
import Link from "next/link";
import { PortalPanel, PortalStats } from "@/components/layout/portal";
import portal from "@/components/layout/portal.module.css";
import {
  CalendarDays,
  Bell,
  ClipboardCheck,
  BriefcaseBusiness,
  Wallet,
} from "lucide-react";
import { PageHeading } from "@/components/layout/page-heading";
import { StatusBadge } from "@/components/booking/status-badge";
import { workflowSession } from "@/lib/workflow/session";
import { dayAndTime } from "@/lib/matching/format";
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
      label: "Upcoming visits",
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
      label: "Active projects",
      value: active.length,
      href: "/customer/bookings",
      Icon: BriefcaseBusiness,
    },
    {
      label: "Bookings with balance",
      value: balances.length,
      href: "/customer/bookings",
      Icon: Wallet,
    },
  ];
  return (
    <section className={styles.page}>
      <PageHeading
        title="Customer dashboard"
        description={`Welcome${profile.first_name ? ", " + profile.first_name : ""}. Here are your requests and updates.`}
        trailing={
          <ActionLink href="/customer/bookings/new">Book a service</ActionLink>
        }
      />
      <PortalStats
        items={metrics.map((m) => ({
          label: m.label,
          value: m.value,
          href: m.href,
          icon: m.Icon,
          tone:
            m.label === "Pending approvals" ||
            m.label === "Bookings with balance"
              ? ("warning" as const)
              : ("brand" as const),
        }))}
      />
      <div className={portal.columns}>
        <PortalPanel
          title="Recent service requests"
          icon={CalendarDays}
          action={<ActionLink href="/customer/bookings">View all</ActionLink>}
        >
          {!rows.length ? (
            <div className={portal.panelBody}>
              <p>No service requests yet.</p>
              <ActionLink href="/customer/bookings/new">
                Book your first service
              </ActionLink>
            </div>
          ) : (
            <ul className={portal.queueCards}>
              {rows.slice(0, 6).map((b) => {
                const service = Array.isArray(b.services)
                  ? b.services[0]
                  : b.services;
                return (
                  <li key={b.id}>
                    <Link
                      className={portal.queueCard}
                      href={`/customer/bookings/${b.id}`}
                    >
                      <span className={portal.queueCardHead}>
                        <strong>{service?.name ?? "Service request"}</strong>
                        <StatusBadge status={b.official_status} />
                      </span>
                      <span className={portal.queueService}>
                        BK-{b.id.slice(0, 8)}
                      </span>
                      <span className={portal.queueDate}>
                        <CalendarDays aria-hidden="true" />
                        {b.schedule_confirmed_at && b.scheduled_start
                          ? "Confirmed: " + dayAndTime(b.scheduled_start)
                          : "Awaiting appointment confirmation"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </PortalPanel>
        <div className={styles.page}>
          <PortalPanel title="Your next step" icon={ClipboardCheck}>
            <div className={portal.panelBody}>
              <p>
                {approvals.length
                  ? "Review the quotation, contract or appointment waiting for your approval."
                  : active.length
                    ? "Open your booking for confirmed dates and reviewed progress."
                    : "Request a service. MAZ will review and confirm your appointment."}
              </p>
              {upcoming[0]?.scheduled_start && (
                <p>Next visit: {dayAndTime(upcoming[0].scheduled_start)}</p>
              )}
              <ActionLink
                href={
                  approvals[0]
                    ? `/customer/bookings/${approvals[0].booking_id}`
                    : "/customer/bookings"
                }
              >
                View your booking
              </ActionLink>
            </div>
          </PortalPanel>
          <PortalPanel
            title="Recent updates"
            icon={Bell}
            action={
              <ActionLink href="/customer/notifications">View all</ActionLink>
            }
          >
            {!notifications.data?.length ? (
              <p className={portal.empty}>You’re all caught up.</p>
            ) : (
              <ul className={portal.rows}>
                {notifications.data.map((n) => (
                  <li className={portal.row} key={n.id}>
                    <div className={portal.rowCopy}>
                      <strong>{n.title}</strong>
                      <ActionLink
                        href={
                          n.link?.startsWith("/") && !n.link.startsWith("//")
                            ? n.link
                            : "/customer/notifications"
                        }
                      >
                        Read update
                      </ActionLink>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PortalPanel>
        </div>
      </div>
    </section>
  );
}
