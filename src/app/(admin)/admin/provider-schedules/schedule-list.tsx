import Link from "next/link";
import { Search } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_LABELS, type BookingStatus } from "@/lib/booking/rules";
import styles from "./page.module.css";

type Person = { first_name: string | null; last_name: string | null };
type Booking = {
  id: string;
  status: BookingStatus;
  provider_id: string | null;
  picked_provider_id: string | null;
  is_urgent: boolean;
  preferred_start: string | null;
  scheduled_start: string | null;
  description: string | null;
  services: { name: string } | { name: string }[] | null;
  customer: Person | Person[] | null;
  address: { barangay: string | null; city: string } | { barangay: string | null; city: string }[] | null;
};

const one = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;
const fullName = (person: Person | null, fallback: string) => [person?.first_name, person?.last_name].filter(Boolean).join(" ") || fallback;
const dateText = (value: string | null) => value
  ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "Date not set";
const statusText = (status: BookingStatus) => STATUS_LABELS[status] ?? status.replaceAll("_", " ");

export async function ScheduleList({ query }: { query?: string }) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("bookings").select(`
    id,status,provider_id,picked_provider_id,is_urgent,preferred_start,scheduled_start,description,
    services:services!bookings_service_id_fkey(name),
    customer:profiles!bookings_customer_id_fkey(first_name,last_name),
    address:addresses!bookings_address_id_fkey(barangay,city),
    provider:profiles!bookings_provider_id_fkey(first_name,last_name),
    picked_provider:profiles!bookings_picked_provider_id_fkey(first_name,last_name)
  `).not("status", "in", "(draft,cancelled)")
    .or("scheduled_start.not.is.null,preferred_start.not.is.null")
    .order("scheduled_start", { ascending: true, nullsFirst: false })
    .order("preferred_start", { ascending: true, nullsFirst: false })
    .limit(1000);

  const needle = query?.trim().slice(0, 100).toLocaleLowerCase() ?? "";
  const rows = ((data ?? []) as unknown as (Booking & { provider: Person | Person[] | null; picked_provider: Person | Person[] | null })[])
    .flatMap((row) => {
      const providerId = row.provider_id ?? row.picked_provider_id;
      const provider = one(row.provider_id ? row.provider : row.picked_provider);
      if (!providerId || !provider) return [];
      const personName = fullName(provider, "Provider");
      const serviceName = one(row.services)?.name ?? "Service project";
      const customerName = fullName(one(row.customer), "Customer");
      const address = one(row.address);
      const area = [address?.barangay, address?.city].filter(Boolean).join(", ") || "Service area not listed";
      const searchable = [personName, serviceName, customerName, area, statusText(row.status), row.description ?? ""].join(" ").toLocaleLowerCase();
      if (needle && !searchable.includes(needle)) return [];
      return [{
        id: row.id, providerId, providerName: personName, serviceName, customerName, area,
        status: row.status, urgent: row.is_urgent, description: row.description,
        date: row.scheduled_start ?? row.preferred_start,
      }];
    });

  const providers = new Map<string, typeof rows>();
  for (const booking of rows) providers.set(booking.providerId, [...(providers.get(booking.providerId) ?? []), booking]);
  const groups = [...providers.entries()].map(([id, jobs]) => ({ id, name: jobs[0].providerName, jobs }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return <>
    <form className={styles.toolbar} action="/admin/provider-schedules" method="get">
      <label className={styles.search}>
        <Search aria-hidden="true" />
        <span className={styles.srOnly}>Search provider schedules</span>
        <input type="search" name="q" defaultValue={query} placeholder="Search provider, service, customer, or area" />
      </label>
      <button className={styles.searchButton} type="submit">Search</button>
      <p>{groups.length} provider{groups.length === 1 ? "" : "s"} · {rows.length} assigned job{rows.length === 1 ? "" : "s"}</p>
    </form>
    {error ? <p role="alert">Could not load provider schedules: {error.message}</p> : groups.length ? <div className={styles.providerList}>
      {groups.map((group) => <section className={styles.providerCard} key={group.id}>
        <header className={styles.providerHeader}>
          <div><h2>{group.name}</h2><p>{group.jobs.length} assigned job{group.jobs.length === 1 ? "" : "s"}</p></div>
          <Link href={`/admin/provider-schedules?q=${encodeURIComponent(group.name)}`}>View jobs</Link>
        </header>
        <ul className={styles.jobList}>
          {group.jobs.map((job) => <li className={styles.jobCard} key={job.id}>
            <div className={styles.jobTitle}><h3>{job.serviceName}</h3><span className={styles.status} data-status={job.status}>{statusText(job.status)}</span></div>
            <dl className={styles.jobDetails}>
              <div><dt>Appointment</dt><dd>{dateText(job.date)}{!job.date ? " · Waiting for a date" : ""}</dd></div>
              <div><dt>Customer</dt><dd>{job.customerName}</dd></div>
              <div><dt>Service area</dt><dd>{job.area}</dd></div>
              {job.urgent && <div><dt>Priority</dt><dd>Urgent</dd></div>}
            </dl>
            {job.description && <p className={styles.description}>{job.description}</p>}
            <Link className={styles.jobLink} href="/admin/bookings">Open booking details</Link>
          </li>)}
        </ul>
      </section>)}
    </div> : <div className={styles.emptyState}><h2>{needle ? "No matching schedules" : "No assigned provider schedules yet"}</h2><p>{needle ? "Try another provider, service, customer, or area." : "Provider jobs appear here after a provider is assigned."}</p></div>}
  </>;
}
