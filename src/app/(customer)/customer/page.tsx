import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, Mail, MapPin, Phone, Siren } from "lucide-react";
import { StatusBadge } from "@/components/booking/status-badge";
import { PageHeading } from "@/components/layout/page-heading";
import { databaseStatusesFor, officialStatus } from "@/lib/booking/official-status";
import { dayAndTime, peso } from "@/lib/matching/format";
import { createClient } from "@/lib/supabase/server";
import { ServiceIcon } from "@/components/public/service-icon";
import { BUSINESS } from "@/lib/public/business-info";
import styles from "./home.module.css";

const MONEY = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default async function CustomerHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/customer");
  const activeStatuses = [...databaseStatusesFor("Pending"), ...databaseStatusesFor("Assigned"), ...databaseStatusesFor("Ongoing")];
  const [{ data: services, error: serviceError }, { data: bookings, error: bookingError }, { data: profile }, { data: waiting }, { data: quotesWaiting }, { data: unread }] = await Promise.all([
    supabase.from("services").select("id,category,name,description,starting_price_php").eq("active", true).order("sort_order").order("name"),
    supabase.from("bookings").select("id,status,description,updated_at,preferred_start,is_urgent,services:services!bookings_service_id_fkey(name)")
      .eq("customer_id", user.id).in("status", activeStatuses)
      .order("updated_at", { ascending: false }).limit(5),
    supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle(),
    // Drafts and submitted requests that still need the customer's attention.
    supabase.from("bookings").select("id,status,services:services!bookings_service_id_fkey(name)")
      .eq("customer_id", user.id).in("status", ["draft", "open"])
      .order("updated_at", { ascending: false }).limit(5),
    // Quotes the customer still has to answer (spec 6.2).
    supabase.from("quotes").select("booking_id,amount,bookings(services:services!bookings_service_id_fkey(name))").eq("status", "proposed").order("created_at", { ascending: false }).limit(5),
    supabase.from("notifications").select("id,title,link,created_at", { count: "exact" }).is("read_at", null).order("created_at", { ascending: false }).limit(3),
  ]);
  const active = bookings ?? [];
  const nextSchedule = active
    .filter((row) => row.preferred_start && new Date(row.preferred_start) > new Date())
    .sort((a, b) => new Date(a.preferred_start!).getTime() - new Date(b.preferred_start!).getTime())[0];
  const serviceGroups = new Map<string, NonNullable<typeof services>[number][]>();
  for (const service of services ?? []) serviceGroups.set(service.category, [...(serviceGroups.get(service.category) ?? []), service]);
  // Emergency Service is the only urgent service. The booking form opens on it when it is in the list.
  const emergency = (services ?? []).find((service) => service.category === "Emergency" || service.name === "Emergency Service");
  return (
    <section className={styles.page}>
      <PageHeading title={profile?.first_name ? `Hi, ${profile.first_name}` : "Home"} description="Choose a service or check on a request you already made." trailing={<Link className={styles.bookAction} href="/customer/bookings/new">Book a Service</Link>} />
      {bookingError ? <p className={styles.loadError} role="alert">Your active jobs could not be loaded. <Link href="/customer">Retry</Link></p>
        : active.length > 0 ? <section aria-labelledby="active-title" className={styles.attention}>
        <h2 id="active-title" className={styles.attentionHeading}>Active bookings</h2>
        <ul className={styles.attentionRows}>{active.map((row) => <li key={row.id} className={styles.attentionRow}>
          <span><strong>{first(row.services)?.name ?? "Service request"}</strong>{" "}<StatusBadge status={officialStatus(row.status) ?? "Pending"} /></span>
          <Link href={`/customer/bookings/${row.id}`}>View booking</Link>
        </li>)}</ul>
        {nextSchedule?.preferred_start && <p className={styles.muted}>Next schedule: {dayAndTime(nextSchedule.preferred_start)} · {first(nextSchedule.services)?.name ?? "Service request"}</p>}
      </section> : <div className={styles.emptyJob}>
        <strong>No active bookings yet</strong>
        <span>When you book, updates and progress will appear here.</span>
        <Link href="/customer/bookings/new">Start your first booking</Link>
      </div>}
      {(quotesWaiting ?? []).length > 0 && <section className={styles.attention} aria-labelledby="quotes-title">
        <h2 id="quotes-title" className={styles.attentionHeading}>Quotes waiting for your approval</h2>
        <ul className={styles.attentionRows}>{(quotesWaiting ?? []).map((quote) => {
          const booking = first(quote.bookings as Embedded<{ services: Embedded<{ name: string }> }>);
          return <li key={quote.booking_id} className={styles.attentionRow}>
            <span>{first(booking?.services ?? null)?.name ?? "Service request"}: {peso(Number(quote.amount))}</span>
            <Link href={`/customer/bookings/${quote.booking_id}`}>Review quote</Link>
          </li>;
        })}</ul>
      </section>}
      {(unread ?? []).length > 0 && <section className={styles.attention} aria-labelledby="unread-title">
        <h2 id="unread-title" className={styles.attentionHeading}>New notifications</h2>
        <ul className={styles.attentionRows}>{(unread ?? []).map((item) => <li key={item.id} className={styles.attentionRow}>
          <span>{item.title}</span>
          <Link href={item.link && item.link.startsWith("/") && !item.link.startsWith("//") ? item.link : "/customer/notifications"}>Open</Link>
        </li>)}</ul>
        <Link href="/customer/notifications">All notifications</Link>
      </section>}
      {(waiting ?? []).length > 0 && <section className={styles.attention} aria-labelledby="attention-title">
        <h2 id="attention-title" className={styles.attentionHeading}>Needs your attention</h2>
        <ul className={styles.attentionRows}>{(waiting ?? []).map((row) => <li key={row.id} className={styles.attentionRow}>
          <span>{first(row.services)?.name ?? "Service request"}: {row.status === "draft" ? "draft not submitted" : "request submitted"}</span>
          <Link href={row.status === "draft" ? `/customer/bookings/new?draft=${row.id}` : `/customer/bookings/${row.id}`}>
            {row.status === "draft" ? "Continue this draft" : "View booking"}
          </Link>
        </li>)}</ul>
      </section>}
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
      {emergency && <section className={styles.emergency} aria-labelledby="emergency-title">
        <Siren className={styles.emergencyIcon} aria-hidden="true" />
        <div>
          <h2 id="emergency-title" className={styles.emergencyTitle}>Need help right away?</h2>
          <p className={styles.muted}>Burst pipe or sparking outlet? Book Emergency Service{BUSINESS.hoursNote ? `. ${BUSINESS.hoursNote}.` : "."}</p>
        </div>
        <Link className={styles.emergencyAction} href={`/customer/bookings/new?service=${emergency.id}`}>Book emergency service</Link>
      </section>}
      <div className={styles.howItWorks}>
        <strong>How it works</strong>
        <span>Tell us about the job · Choose an approved provider · Confirm the quote · Track the work</span>
      </div>
      <section className={styles.about} aria-labelledby="about-title">
        <h2 id="about-title" className={styles.aboutTitle}>About us</h2>
        <p className={styles.muted}>{BUSINESS.about ?? BUSINESS.tagline} Now serving {BUSINESS.serviceArea}.</p>
        <ul className={styles.contact} aria-label="Contact us">
          {BUSINESS.address && <li><MapPin aria-hidden="true" /><span>{BUSINESS.address}</span></li>}
          {BUSINESS.hours && <li><Clock aria-hidden="true" /><span>{BUSINESS.hours}</span></li>}
          {BUSINESS.phones.map((phone) => <li key={phone}><Phone aria-hidden="true" /><a href={`tel:${phone.replace(/\D/g, "")}`}>{phone}</a></li>)}
          {BUSINESS.email && <li><Mail aria-hidden="true" /><a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a></li>}
        </ul>
      </section>
    </section>
  );
}

type Embedded<T> = T | T[] | null;

function first<T>(value: Embedded<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
