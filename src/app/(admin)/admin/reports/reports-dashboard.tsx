"use client";

import { useRouter } from "next/navigation";
import { Activity, ArrowDownToLine, BriefcaseBusiness, CalendarDays, CheckCircle2, CircleDollarSign, Star, Wrench } from "lucide-react";
import styles from "./reports-dashboard.module.css";

export type ReportsData = {
  period: "30" | "90" | "year";
  rangeLabel: string;
  summary: {
    totalBookings: number;
    completedBookings: number;
    inProgressBookings: number;
    urgentBookings: number;
  };
  payments: {
    collected: number;
    refunded: number;
    outstanding: number;
    pendingCount: number;
  };
  trend: { label: string; count: number }[];
  statuses: { status: string; count: number }[];
  providers: { name: string; bookings: number; averageRating: number | null; reviewCount: number }[];
  services: { name: string; category: string; bookings: number }[];
};

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export function ReportsDashboard({ data, loadErrors }: { data: ReportsData; loadErrors: string[] }) {
  const router = useRouter();
  const maxTrend = Math.max(1, ...data.trend.map((item) => item.count));
  const maxStatus = Math.max(1, ...data.statuses.map((item) => item.count));
  const trendLabelInterval = data.period === "30" ? 5 : data.period === "90" ? 2 : 1;
  const selectedPeriod = data.period;

  function changePeriod(period: string) {
    router.push(`/admin/reports?period=${period}`);
  }

  function exportCsv() {
    const rows: unknown[][] = [
      ["Report", "Metric", "Value", "Date range"],
      ["Summary", "Total bookings", data.summary.totalBookings, data.rangeLabel],
      ["Summary", "Completed bookings", data.summary.completedBookings, data.rangeLabel],
      ["Summary", "In-progress bookings", data.summary.inProgressBookings, data.rangeLabel],
      ["Summary", "Urgent bookings", data.summary.urgentBookings, data.rangeLabel],
      ["Payments", "Net collected", data.payments.collected, data.rangeLabel],
      ["Payments", "Refunded", data.payments.refunded, data.rangeLabel],
      ["Payments", "Pending amount", data.payments.outstanding, data.rangeLabel],
      ...data.statuses.map((item) => ["Booking status", item.status, item.count, data.rangeLabel]),
      ...data.services.map((item) => ["Popular services", `${item.category} — ${item.name}`, item.bookings, data.rangeLabel]),
      ...data.providers.map((item) => [
        "Provider workload",
        `${item.name}${item.averageRating === null ? "" : ` (${item.averageRating.toFixed(1)} average rating, ${item.reviewCount} reviews)`}`,
        item.bookings,
        data.rangeLabel,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `maz-reports-${data.period}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Insights</p>
          <h1>Reports</h1>
          <p>Bookings, payments, providers, and service demand at a glance.</p>
        </div>
        <div className={styles.headerActions}>
          <label className={styles.period}>
            <CalendarDays aria-hidden="true" className={styles.icon16} />
            <span className={styles.srOnly}>Report date range</span>
            <select value={selectedPeriod} onChange={(event) => changePeriod(event.target.value)}>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="year">Year to date</option>
            </select>
          </label>
          <button type="button" className={styles.exportButton} onClick={exportCsv}>
            <ArrowDownToLine aria-hidden="true" className={styles.icon16} /> Export CSV
          </button>
        </div>
      </header>

      <p className={styles.rangeLabel}>Reporting period: <strong>{data.rangeLabel}</strong></p>
      {loadErrors.map((error, index) => <p role="alert" className={styles.error} key={`${index}-${error}`}>Could not load all report data: {error}</p>)}

      <section className={styles.metrics} aria-label="Booking and revenue summary">
        <Metric icon={<BriefcaseBusiness aria-hidden="true" />} label="Total bookings" value={data.summary.totalBookings.toLocaleString()} note={`${data.summary.urgentBookings} urgent`} />
        <Metric icon={<CheckCircle2 aria-hidden="true" />} label="Completed" value={data.summary.completedBookings.toLocaleString()} note={`${data.summary.inProgressBookings} currently in progress`} />
        <Metric icon={<CircleDollarSign aria-hidden="true" />} label="Net collected" value={currency.format(data.payments.collected)} note={`${currency.format(data.payments.refunded)} refunded`} />
        <Metric icon={<Activity aria-hidden="true" />} label="Pending payments" value={currency.format(data.payments.outstanding)} note={`${data.payments.pendingCount} awaiting payment`} />
      </section>

      <section className={styles.panel} aria-labelledby="bookings-trend-title">
        <div className={styles.panelHeading}>
          <div><h2 id="bookings-trend-title">Booking volume</h2><p>New booking requests during this period</p></div>
          <span className={styles.panelTotal}>{data.summary.totalBookings} bookings</span>
        </div>
        <div className={`${styles.chart} ${data.period === "30" ? styles.dailyChart : ""}`} role="img" aria-label="Bookings created over the selected period">
          {data.trend.map((item, index) => (
            <div className={styles.barColumn} key={`${item.label}-${index}`} title={`${item.label}: ${item.count} bookings`}>
              <span className={styles.barValue}>{item.count || ""}</span>
              <span className={styles.barTrack}><span className={styles.bar} style={{ height: `${Math.max(3, item.count / maxTrend * 100)}%` }} /></span>
              <span className={styles.barLabel}>{index % trendLabelInterval === 0 || index === data.trend.length - 1 ? item.label : ""}</span>
            </div>
          ))}
          {!data.trend.length && <p className={styles.emptyChart}>No booking activity in this period.</p>}
        </div>
      </section>

      <div className={styles.twoColumn}>
        <section className={styles.panel} aria-labelledby="booking-status-title">
          <div className={styles.panelHeading}>
            <div><h2 id="booking-status-title">Booking status</h2><p>Requests by their current status</p></div>
          </div>
          {data.statuses.length ? (
            <ul className={styles.breakdown}>
              {data.statuses.map((item) => (
                <li key={item.status}>
                  <div className={styles.breakdownText}><span>{item.status}</span><strong>{item.count}</strong></div>
                  <span className={styles.progressTrack}><span style={{ width: `${item.count / maxStatus * 100}%` }} /></span>
                </li>
              ))}
            </ul>
          ) : <EmptyState>No bookings in this period.</EmptyState>}
        </section>

        <section className={styles.panel} aria-labelledby="popular-services-title">
          <div className={styles.panelHeading}>
            <div><h2 id="popular-services-title">Popular services</h2><p>Most requested service types</p></div>
            <Wrench aria-hidden="true" className={`${styles.panelIcon} ${styles.icon18}`} />
          </div>
          {data.services.length ? (
            <ol className={styles.rankedList}>
              {data.services.map((service, index) => (
                <li key={`${service.category}-${service.name}`}>
                  <span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.rankName}><strong>{service.name}</strong><small>{service.category}</small></span>
                  <b>{service.bookings}</b>
                </li>
              ))}
            </ol>
          ) : <EmptyState>No service bookings in this period.</EmptyState>}
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="provider-workload-title">
        <div className={styles.panelHeading}>
          <div><h2 id="provider-workload-title">Provider workload &amp; ratings</h2><p>Assigned work and customer ratings in this period</p></div>
          <Star aria-hidden="true" className={`${styles.panelIcon} ${styles.icon18}`} />
        </div>
        {data.providers.length ? (
          <div className={styles.providerTable}>
            <div className={`${styles.providerRow} ${styles.tableHead}`}><span>Provider</span><span>Assigned bookings</span><span>Rating</span></div>
            {data.providers.map((provider, index) => (
              <div className={styles.providerRow} key={`${provider.name}-${index}`}>
                <strong>{provider.name}</strong>
                <span>{provider.bookings}</span>
                <span className={styles.rating}>
                  {provider.averageRating === null ? "—" : <><Star fill="currentColor" aria-hidden="true" className={styles.icon14} /> {provider.averageRating.toFixed(1)} <small>({provider.reviewCount})</small></>}
                </span>
              </div>
            ))}
          </div>
        ) : <EmptyState>No assigned provider work in this period.</EmptyState>}
      </section>

      <p className={styles.note}>Revenue is based on successful payments, less refunds. Booking and service totals use request creation dates.</p>
    </main>
  );
}

function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <article className={styles.metric}>
    <span className={styles.metricIcon}>{icon}</span>
    <span className={styles.metricLabel}>{label}</span>
    <strong className={styles.metricValue}>{value}</strong>
    <span className={styles.metricNote}>{note}</span>
  </article>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
