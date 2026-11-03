import styles from "./list.module.css";
import Link from "next/link";
import { Suspense } from "react";
import { loadPublicServices } from "@/lib/public/load-services";
import { PageHeading } from "@/components/layout/page-heading";

export default function CustomerServicesPage() {
  return <section><PageHeading title="Services" description="Browse completed-job photos, ratings and service information before booking." />
    <Suspense fallback={<p>Loading services…</p>}><ServiceList /></Suspense></section>;
}
async function ServiceList() {
  const services = await loadPublicServices();
  return <ul className={styles.list}>
    {services.map(service => <li key={`${service.category}-${service.name}`} className={styles.card}>
      <h2 className={styles.title}>{service.name}</h2>
      <p>{service.description}</p>
      <Link href={service.id ? `/customer/services/${service.id}` : "/customer/bookings/new"}>View service details</Link>
    </li>)}
  </ul>;
}
