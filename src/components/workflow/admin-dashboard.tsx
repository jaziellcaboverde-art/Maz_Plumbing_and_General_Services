import { ActionLink } from "@/components/ui/action-link";
﻿import Link from "next/link";
import {
  ClipboardList,
  Wallet,
  ClipboardCheck,
  MessageSquare,
  CalendarDays,
  Clock,
  Wrench,
  CheckCircle2,
} from "lucide-react";
import { PageHeading } from "@/components/layout/page-heading";
import { PortalPanel, PortalStats } from "@/components/layout/portal";
import { workflowSession } from "@/lib/workflow/session";
import { dayAndTime } from "@/lib/matching/format";
import styles from "./workflow.module.css";
import portal from "@/components/layout/portal.module.css";
export async function AdminDashboard() {
  const { client } = await workflowSession("admin");
  const [results, counts] = await Promise.all([
    Promise.all([
      client
        .from("bookings")
        .select("id,description,created_at", { count: "exact" })
        .in("status", ["open", "offered"])
        .is("admin_accepted_at", null)
        .order("created_at")
        .limit(20),
      client
        .from("manual_payment_claims")
        .select("id,booking_id,created_at,amount", { count: "exact" })
        .eq("status", "pending")
        .order("created_at")
        .limit(20),
      client
        .from("provider_work_updates")
        .select("id,booking_id,kind,created_at", { count: "exact" })
        .eq("review_status", "pending")
        .order("created_at")
        .limit(20),
      client
        .from("booking_requests")
        .select("id,booking_id,kind,created_at", { count: "exact" })
        .eq("status", "requested")
        .order("created_at")
        .limit(20),
    ]),
    Promise.all([
      client
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .neq("status", "draft"),
      client
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .neq("status", "draft")
        .eq("official_status", "Pending"),
      client
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("official_status", "Ongoing"),
      client
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("official_status", "Completed"),
    ]),
  ]);
  const queues = [
    {
      title: "Requests to review",
      href: "/admin/bookings?status=Pending",
      icon: ClipboardList,
    },
    { title: "Payment checks", href: "/admin/payments", icon: Wallet },
    {
      title: "Worker updates",
      href: "/admin/provider-work-updates",
      icon: ClipboardCheck,
    },
    {
      title: "Customer requests",
      href: "/admin/payments",
      icon: MessageSquare,
    },
  ];
  const labels = ["Total bookings", "Pending", "Ongoing", "Completed"],
    icons = [CalendarDays, Clock, Wrench, CheckCircle2];
  const total = counts[0].count ?? 0;
  return (
    <section className={styles.page}>
      <PageHeading
        title="Admin dashboard"
        description="Welcome, Admin. Here’s the latest view of MAZ operations."
        trailing={<ActionLink href="/admin/create-booking">Create booking</ActionLink>}
      />
      {counts.some((c) => c.error) ? (
        <p role="alert">Could not load booking totals.</p>
      ) : (
        <PortalStats
          items={labels.map((label, i) => ({
            label,
            value: counts[i].count ?? 0,
            href: i ? `/admin/bookings?status=${labels[i]}` : "/admin/bookings",
            icon: icons[i],
            tone:
              i === 1
                ? ("warning" as const)
                : i === 3
                  ? ("success" as const)
                  : ("brand" as const),
          }))}
        />
      )}
      <div className={portal.columns}>
        <PortalPanel
          title="Needs attention"
          icon={ClipboardList}
          action={<ActionLink href="/admin/bookings">View bookings</ActionLink>}
        >
          {results.some((r) => r.error) ? (
            <p className={portal.empty} role="alert">
              Could not load the review queues. Please refresh.
            </p>
          ) : (
            <ul className={portal.rows}>
              {queues.map((q, i) => (
                <li className={portal.row} key={q.title}>
                  <div className={portal.rowCopy}>
                    <Link href={q.href} className={portal.rowTitle}>
                      <q.icon className={portal.panelIcon} aria-hidden="true" />
                      <strong>{q.title}</strong>
                    </Link>
                  </div>
                  <strong className={styles.amount}>
                    {results[i].count ?? 0}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </PortalPanel>
        <PortalPanel title="Bookings overview" icon={CalendarDays}>
          <div className={portal.panelBody}>
            {counts.some((c) => c.error) ? (
              <p>Overview unavailable.</p>
            ) : (
              labels.slice(1).map((label, i) => (
                <div className={portal.progressRow} key={label}>
                  <span>{label}</span>
                  <strong>{counts[i + 1].count ?? 0}</strong>
                  <progress
                    aria-label={`${label} bookings`}
                    value={counts[i + 1].count ?? 0}
                    max={Math.max(total, 1)}
                  />
                </div>
              ))
            )}
            <ActionLink href="/admin/reports">View reports</ActionLink>
          </div>
        </PortalPanel>
      </div>
      <div className={styles.grid}>
        {queues.map((q, i) => !results[i].error && !results[i].data?.length ? null : (
          <PortalPanel
            key={q.title}
            title={q.title}
            icon={q.icon}
            action={<ActionLink href={q.href}>View all</ActionLink>}
          >
            {results[i].error ? (
              <p className={portal.empty}>Could not load this queue.</p>
            ) : !results[i].data?.length ? (
              <p className={portal.empty}>No items awaiting action.</p>
            ) : (
              <ul className={portal.rows}>
                {results[i].data?.slice(0, 5).map((row) => {
                  const booking = "booking_id" in row ? row.booking_id : row.id;
                  return (
                    <li className={portal.row} key={row.id}>
                      <div className={portal.rowCopy}>
                        <Link href={`/admin/bookings/${booking}`}>
                          <strong>
                            {"kind" in row
                              ? row.kind.replaceAll("_", " ")
                              : "description" in row
                                ? row.description?.slice(0, 80)
                                : "Verify payment"}
                          </strong>
                        </Link>
                        <small>{dayAndTime(row.created_at)}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </PortalPanel>
        ))}
      </div>
      <div className={portal.tabs}>
        {[
          ["Assignments", "assignments"],
          ["Quotes & contracts", "quotes"],
          ["Payments & refunds", "payments"],
          ["Reports", "reports"],
          ["Portfolio & reviews", "portfolio"],
          ["Business configuration", "config"],
        ].map(([label, path]) => (
          <Link key={path} className={portal.tab} href={`/admin/${path}`}>
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}
