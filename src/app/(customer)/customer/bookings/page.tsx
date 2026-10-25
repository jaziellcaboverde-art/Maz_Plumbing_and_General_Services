import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { STATUS_LABELS, type BookingStatus } from "@/lib/booking/rules";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export default function CustomerBookingsPage() {
  return <Suspense fallback={<p role="status">Loading your bookings…</p>}><BookingsContent /></Suspense>;
}

type Row = {
  id: string;
  status: BookingStatus;
  description: string | null;
  preferred_start: string | null;
  is_urgent: boolean;
  created_at: string;
  services: { name: string } | null;
};

const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

async function BookingsContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/customer/bookings");
  const { data, error } = await supabase
    .from("bookings")
    .select("id,status,description,preferred_start,is_urgent,created_at,services(name)")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .returns<Row[]>();
  const rows = data ?? [];
  const newLink = <Link className={styles.primaryLink} href="/customer/bookings/new">Book a service</Link>;

  return (
    <section className={styles.page}>
      <PageHeading title="Bookings" description="Your service requests and their status." trailing={rows.length > 0 ? newLink : undefined} />
      {error && <p role="alert">Could not load your bookings: {error.message}. Refresh the page to try again.</p>}
      {!error && rows.length === 0 && (
        <EmptyState icon={CalendarDays} title="No bookings yet. Book a service." description="Pick a service, add your address and choose when you need us." action={newLink} />
      )}
      {rows.length > 0 && (
        <ul className={styles.list}>
          {rows.map((row) => {
            const href = row.status === "draft" ? `/customer/bookings/new?draft=${row.id}` : `/customer/bookings/${row.id}`;
            return (
              <li key={row.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <h2 className={styles.itemTitle}>{row.services?.name ?? "Service not chosen yet"}</h2>
                  <span className={styles.status} data-status={row.status}>{STATUS_LABELS[row.status]}</span>
                </div>
                {row.description && <p className={styles.itemText}>{row.description}</p>}
                <p className={styles.itemMeta}>
                  {row.is_urgent ? "Urgent" : row.preferred_start ? dateFormat.format(new Date(row.preferred_start)) : "No date chosen"}
                </p>
                <Link className={styles.itemLink} href={href}>{row.status === "draft" ? "Continue this draft" : "View booking"}</Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
