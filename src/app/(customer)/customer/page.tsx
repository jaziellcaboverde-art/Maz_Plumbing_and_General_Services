import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/layout/page-heading";
import { createClient } from "@/lib/supabase/server";
import { ServiceIcon } from "@/components/public/service-icon";
import styles from "./home.module.css";

const MONEY = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default async function CustomerHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/customer");
  const [{ data: services, error: serviceError }, { data: bookings, error: bookingError }] = await Promise.all([
    supabase.from("services").select("id,category,name,description,starting_price_php").eq("active", true).order("sort_order").order("name"),
    supabase.from("bookings").select("id,status,description,updated_at,services:services!bookings_service_id_fkey(name)")
      .eq("customer_id", user.id).not("status", "in", "(draft,cancelled,completed,balance_paid,signed)")
      .order("updated_at", { ascending: false }).limit(1),
  ]);
  const active = bookings?.[0];
  const serviceGroups = new Map<string, NonNullable<typeof services>[number][]>();
  for (const service of services ?? []) serviceGroups.set(service.category, [...(serviceGroups.get(service.category) ?? []), service]);
  return (
    <section className={styles.page}>
      <PageHeading title="Home" description="Choose a service or check on a request you already made." />
      {bookingError ? <p className={styles.loadError} role="alert">Your active jobs could not be loaded. <Link href="/customer">Retry</Link></p>
        : active ? <Link className={styles.activeJob} href={`/customer/bookings/${active.id}`}>
        <span>Active job</span>
        <strong>{first(active.services)?.name ?? "Service request"}</strong>
        <span>{active.status.replaceAll("_", " ")}</span>
        <span className={styles.jobLink}>View job →</span>
      </Link> : <div className={styles.emptyJob}>
        <strong>No active jobs yet</strong>
        <span>When you book, updates and progress will appear here.</span>
        <Link href="/customer/bookings/new">Start your first booking</Link>
      </div>}
      <section aria-labelledby="customer-services-title">
        <div className={styles.sectionHeading}>
          <div><h2 id="customer-services-title">Our services</h2><p>Choose a service to see details and starting prices.</p></div>
          <Link href="/customer/bookings">My bookings</Link>
        </div>
        {serviceError ? <p className={styles.loadError} role="alert">Services could not be loaded. <Link href="/customer">Retry</Link></p>
          : !services?.length ? <p className={styles.muted}>Services are temporarily unavailable.</p> :
          [...serviceGroups.entries()].map(([category, items]) => <section className={styles.serviceGroup} key={category}>
            <h3 className={styles.categoryHeading}>{category}</h3>
            <ul className={styles.services}>{items.map((service) => <li key={service.id}>
              <Link className={styles.service} href={`/customer/services/${service.id}`}>
                <span className={styles.serviceIcon}><ServiceIcon category={service.category} /></span>
                <strong>{service.name}</strong>
                {service.description && <span className={styles.description}>{service.description}</span>}
                <span className={styles.price}>{service.starting_price_php == null
                  ? "Price on quote"
                  : `From ${MONEY.format(Number(service.starting_price_php))}`}</span>
                <span className={styles.more}>View details →</span>
              </Link>
            </li>)}</ul>
          </section>)}
      </section>
      <div className={styles.howItWorks}>
        <strong>How it works</strong>
        <span>Tell us about the job · Choose an approved provider · Confirm the quote · Track the work</span>
      </div>
    </section>
  );
}

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
