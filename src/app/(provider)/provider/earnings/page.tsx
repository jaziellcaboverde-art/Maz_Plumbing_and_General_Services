import { Suspense } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { PortalStats, PortalTable } from "@/components/layout/portal";
import { Wallet, Clock } from "lucide-react";
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
        description="Payouts recorded by MAZ."
      />
      <PortalStats
        items={[
          {
            label: "Paid by MAZ",
            value: peso(paid),
            href: "/provider/earnings",
            icon: Wallet,
            tone: "success",
          },
          {
            label: "Pending / on hold",
            value: peso(pending),
            href: "/provider/earnings",
            icon: Clock,
            tone: "warning",
          },
        ]}
      />
      <PortalTable
        label="Payout history"
        columns={["Reference", "Amount", "Status", "Recorded / paid"]}
        empty="No payout records yet."
        rows={rows.map((r) => ({
          key: r.id,
          cells: [
            r.reference || "No reference",
            peso(Number(r.amount)),
            r.status.replaceAll("_", " "),
            dayAndTime(r.paid_at ?? r.created_at),
          ],
        }))}
      />
    </section>
  );
}
