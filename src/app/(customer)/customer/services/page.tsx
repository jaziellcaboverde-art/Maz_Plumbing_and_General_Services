import styles from "./list.module.css";
import { ServiceCardLink } from "@/components/services/service-card-link";
import { Suspense } from "react";
import { loadPublicServices } from "@/lib/public/load-services";
import { servicePath } from "@/lib/public/service-path";
import { PageHeading } from "@/components/layout/page-heading";

export default function CustomerServicesPage() {
  return <section><PageHeading title="Services" description="Browse completed-job photos, ratings and service information before booking." />
    <Suspense fallback={<p>Loading services…</p>}><ServiceList /></Suspense></section>;
}
async function ServiceList() {
  const services = await loadPublicServices();
  return <ul className={styles.list}>
    {services.map(service => <li key={`${service.category}-${service.name}`}>
      <ServiceCardLink name={service.name} customer className={styles.card} href={servicePath(service, true)}>
      <h2 className={styles.title}>{service.name}</h2>
      <p>{service.description}</p>
      <span className={styles.more}>View portfolio &amp; customer reviews</span>
      </ServiceCardLink>
    </li>)}
  </ul>;
}
