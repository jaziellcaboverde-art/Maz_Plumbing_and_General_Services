import { ServiceCardLink } from "@/components/services/service-card-link";
import { loadPublicServices } from "@/lib/public/load-services";
import type { PublicService } from "@/lib/public/launch-services";
import { servicePath } from "@/lib/public/service-path";
import { ServiceIcon } from "./service-icon";
import styles from "./service-grid.module.css";

/** Cards open the portfolio and reviews before booking. */
export function ServiceGrid({ services, bookLinks = false }: { services: readonly PublicService[]; bookLinks?: boolean }) {
  return (
    <ul className={styles.services}>
      {services.map((service) => (
        <li key={`${service.category}-${service.name}`}>
          <ServiceCardLink name={service.name} customer={bookLinks} className={styles.service} href={servicePath(service, bookLinks)}>
            <span className={styles.serviceIcon}><ServiceIcon category={service.category} /></span>
            <p className={styles.serviceCategory}>{service.category}</p>
            <h3 className={styles.serviceName}>{service.name}</h3>
            {service.description && <p className={styles.serviceText}>{service.description}</p>}
            <span className={styles.bookLink}>View portfolio &amp; customer reviews</span>
          </ServiceCardLink>
        </li>
      ))}
    </ul>
  );
}

export async function LiveServices({ bookLinks = false }: { bookLinks?: boolean }) {
  const services = await loadPublicServices();
  return <ServiceGrid services={services} bookLinks={bookLinks} />;
}
