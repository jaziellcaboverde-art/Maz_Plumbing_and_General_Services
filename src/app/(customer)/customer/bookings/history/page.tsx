import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { StatusBadge } from "@/components/booking/status-badge";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { databaseStatusesFor } from "@/lib/booking/official-status";
import { dayAndTime, peso } from "@/lib/matching/format";
import { createClient } from "@/lib/supabase/server";
import styles from "../page.module.css";

export default function ServiceHistoryPage() {
  return <Suspense fallback={<p role="status">Loading your service history…</p>}><HistoryContent /></Suspense>;
}

type Row = {
  id: string;
  updated_at: string;
  quote_total: number | null;
  services: { name: string } | null;
  payments: { id: string; kind: string; amount: number; status: string; method: string | null; paid_at: string | null }[] | null;
  cash_records: { id: string; amount: number; collected_on: string; reference: string }[] | null;
};

/** Service History (spec 6.2): every finished booking with its payment records. Read only. */
async function HistoryContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/customer/bookings/history");
  const { data, error } = await supabase
    .from("bookings")
    .select("id,updated_at,quote_total,services(name),payments(id,kind,amount,status,method,paid_at),cash_records(id,amount,collected_on,reference)")
    .eq("customer_id", user.id)
    .in("status", databaseStatusesFor("Completed"))
    .order("updated_at", { ascending: false })
    .returns<Row[]>();
  const rows = data ?? [];

  return (
    <section className={styles.page}>
      <PageHeading title="Service history" description="Your finished bookings and what you paid." trailing={<Link className={styles.itemLink} href="/customer/bookings">My Bookings</Link>} />
      {error && <p role="alert">Could not load your history: {error.message}. Refresh the page to try again.</p>}
      {!error && rows.length === 0 && <EmptyState icon={History} title="No finished services yet." description="Bookings you complete will be listed here with their payment records." />}
      {rows.length > 0 && (
        <ul className={styles.list}>
          {rows.map((row) => {
            const paid = (row.payments ?? []).filter((payment) => payment.status === "paid");
            return (
              <li key={row.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <h2 className={styles.itemTitle}>{row.services?.name ?? "Service"}</h2>
                  <StatusBadge status="Completed" />
                </div>
                <p className={styles.itemMeta}>Finished {dayAndTime(row.updated_at)}{row.quote_total !== null ? ` · ${peso(Number(row.quote_total))}` : ""}</p>
                {(paid.length > 0 || (row.cash_records ?? []).length > 0) ? (
                  <ul className={styles.facts} aria-label="Payment records">
                    {paid.map((payment) => <li key={payment.id}>{payment.kind === "deposit" ? "Deposit" : payment.kind === "balance" ? "Balance" : "Milestone"} · {peso(Number(payment.amount))}{payment.paid_at ? ` · ${dayAndTime(payment.paid_at)}` : ""}</li>)}
                    {(row.cash_records ?? []).map((record) => <li key={record.id}>Cash · {peso(Number(record.amount))} · ref {record.reference}</li>)}
                  </ul>
                ) : <p className={styles.itemMeta}>No payment records.</p>}
                <Link className={styles.itemLink} href={`/customer/bookings/${row.id}`}>View booking</Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
