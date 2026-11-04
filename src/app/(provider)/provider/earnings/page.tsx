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
    .select("id,booking_id,work_day_id,amount,status,reference,paid_at,created_at")
    .eq("provider_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return <p role="alert">Could not load your payouts.</p>;
  const rows = data ?? [];
  const workDayIds = rows.flatMap((row) => row.work_day_id ? [row.work_day_id] : []);
  const workDays = workDayIds.length
    ? await client
        .from("work_days")
        .select("id,work_date")
        .in("id", workDayIds)
    : { data: [], error: null };
  if (workDays.error) return <p role="alert">Could not load your payout statement.</p>;
  const workDates = new Map(
    (workDays.data ?? []).map((day) => [day.id, day.work_date]),
  );
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
        description="MAZ records approved provider workdays at ₱1,000 per day and processes payout batches on Saturdays."
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
        columns={["Workday / booking", "Amount", "Status", "Reference", "Recorded / paid"]}
        empty="No payout records yet. Each verified workday will appear here after MAZ creates a payout batch."
        rows={rows.map((r) => ({
          key: r.id,
          cells: [
            r.work_day_id
              ? `${workDates.get(r.work_day_id) ?? "Workday"} / ${r.booking_id.slice(0, 8)}`
              : r.booking_id.slice(0, 8),
            peso(Number(r.amount)),
            r.status.replaceAll("_", " "),
            r.reference || "No reference",
            dayAndTime(r.paid_at ?? r.created_at),
          ],
        }))}
      />
    </section>
  );
}
