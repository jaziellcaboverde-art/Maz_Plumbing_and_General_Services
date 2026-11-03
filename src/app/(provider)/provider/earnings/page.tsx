import { Suspense } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { providerSession } from "@/lib/provider/workspace";
import { peso, dayAndTime } from "@/lib/matching/format";
import styles from "@/components/provider/workspace.module.css";
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading payouts...</p>}>
      <Earnings />
    </Suspense>
  );
}
async function Earnings() {
  const { client, user } = await providerSession();
  const { data, error } = await client
    .from("payouts")
    .select("id,amount,status,reference,paid_at,created_at")
    .eq("provider_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return <p role="alert">Could not load your payouts.</p>;
  const rows = data ?? [];
  const paid = rows
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + Number(r.amount), 0);
  const pending = rows
    .filter((r) => r.status === "pending" || r.status === "on_hold")
    .reduce((s, r) => s + Number(r.amount), 0);
  return (
    <section className={styles.stack}>
      <PageHeading
        title="Earnings & payouts"
        description="Your payout records from MAZ. Customer payments are handled and verified by MAZ."
      />
      <div className={styles.grid}>
        <div className={styles.card}>
          <span>Paid by MAZ</span>
          <strong className={styles.number}>{peso(paid)}</strong>
        </div>
        <div className={styles.card}>
          <span>Pending / on hold</span>
          <strong className={styles.number}>{peso(pending)}</strong>
        </div>
      </div>
      {!rows.length ? (
        <EmptyState
          title="No payout records yet"
          description="MAZ-recorded payouts will appear here. A customer's quotation is not your payout amount."
        />
      ) : (
        <ul className={styles.list}>
          {rows.map((r) => (
            <li className={styles.card} key={r.id}>
              <div className={styles.head}>
                <strong>{peso(Number(r.amount))}</strong>
                <span>{r.status.replaceAll("_", " ")}</span>
              </div>
              <p>{dayAndTime(r.paid_at ?? r.created_at)}</p>
              {r.reference && <p>Reference: {r.reference}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
