import Link from "next/link";
import {
  ClipboardList,
  Wallet,
  ClipboardCheck,
  MessageSquare,
} from "lucide-react";
import { PageHeading } from "@/components/layout/page-heading";
import { workflowSession } from "@/lib/workflow/session";
import { dayAndTime } from "@/lib/matching/format";
import styles from "./workflow.module.css";
export async function AdminDashboard() {
  const { client } = await workflowSession("admin");
  const results = await Promise.all([
    client
      .from("bookings")
      .select("id,description,created_at")
      .in("status", ["open", "offered"])
      .is("admin_accepted_at", null)
      .order("created_at")
      .limit(20),
    client
      .from("manual_payment_claims")
      .select("id,booking_id,created_at,amount")
      .eq("status", "pending")
      .order("created_at")
      .limit(20),
    client
      .from("provider_work_updates")
      .select("id,booking_id,kind,created_at")
      .eq("review_status", "pending")
      .order("created_at")
      .limit(20),
    client
      .from("booking_requests")
      .select("id,booking_id,kind,created_at")
      .eq("status", "requested")
      .order("created_at")
      .limit(20),
  ]);
  const queues = [
    {
      title: "Request review",
      href: "/admin/bookings?status=Pending",
      icon: ClipboardList,
    },
    { title: "Payment verification", href: "/admin/payments", icon: Wallet },
    {
      title: "Provider evidence",
      href: "/admin/provider-work-updates",
      icon: ClipboardCheck,
    },
    {
      title: "Customer requests",
      href: "/admin/payments",
      icon: MessageSquare,
    },
  ];
  return (
    <section className={styles.page}>
      <PageHeading
        title="MAZ operations"
        description="Company-managed appointments, scope, teams, payments and completion."
        trailing={
          <Link href="/admin/create-booking">Record customer request</Link>
        }
      />
      <div className={styles.actions}>
        {[
          ["Bookings", "bookings"],
          ["Quotes & contracts", "quotes"],
          ["Payments & refunds", "payments"],
          ["Reports", "reports"],
          ["Portfolio & reviews", "portfolio"],
          ["Business configuration", "config"],
        ].map(([label, path]) => (
          <Link key={path} href={`/admin/${path}`}>
            {label}
          </Link>
        ))}
      </div>
      {results.some((r) => r.error) ? (
        <p role="alert">Could not load the operation queues. Please refresh.</p>
      ) : (
        <div className={styles.grid}>
          {queues.map((q, index) => (
            <article className={styles.card} key={q.title}>
              <q.icon aria-hidden="true" />
              <h2>
                <Link href={q.href}>{q.title}</Link>
              </h2>
              <p>
                {results[index].data?.length ?? 0}
                {results[index].data?.length === 20 ? "+" : ""} awaiting action
              </p>
              <ul className={styles.list}>
                {results[index].data?.map((row) => {
                  const booking = "booking_id" in row ? row.booking_id : row.id;
                  return (
                    <li key={row.id}>
                      <Link href={`/admin/bookings/${booking}`}>
                        {"kind" in row
                          ? row.kind.replaceAll("_", " ")
                          : "description" in row
                            ? row.description?.slice(0, 90)
                            : "Verify payment"}
                      </Link>
                      <p>{dayAndTime(row.created_at)}</p>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      )}
      <article className={styles.card}>
        <h2>Operational flow</h2>
        <p>
          Review request → arrange inspection when required → issue quotation
          and contract → customer approval and configured payment → confirm team
          and agreed execution dates → review provider evidence → MAZ sign-off →
          customer turnover → settle balance and close.
        </p>
        <p>
          Requested times stay provisional. Cancellation and refund decisions
          require documented MAZ review.
        </p>
      </article>
    </section>
  );
}
