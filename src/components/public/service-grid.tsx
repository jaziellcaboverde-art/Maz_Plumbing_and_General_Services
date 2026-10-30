import Link from "next/link";
import { loadPublicServices } from "@/lib/public/load-services";
import type { PublicService } from "@/lib/public/launch-services";
import { ServiceIcon } from "./service-icon";
import styles from "./service-grid.module.css";

/**
 * The service cards. Shared by the guest home page and the customer home page.
 * With bookLinks on, each card links to the booking form with that service already chosen.
 */
export function ServiceGrid({ services, bookLinks = false }: { services: readonly PublicService[]; bookLinks?: boolean }) {
  return (
    <ul className={styles.services}>
      {services.map((service) => (
        <li key={`${service.category}-${service.name}`} className={styles.service}>
          <span className={styles.serviceIcon}><ServiceIcon category={service.category} /></span>
          <p className={styles.serviceCategory}>{service.category}</p>
          <h3 className={styles.serviceName}>{service.name}</h3>
          {service.description && <p className={styles.serviceText}>{service.description}</p>}
          {bookLinks && (
            <Link className={styles.bookLink} href={`/customer/bookings/new?service=${encodeURIComponent(service.name)}`}>
              Book this service
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The live list from the services table (cached), with the launch list as the fallback. */
export async function LiveServices({ bookLinks = false }: { bookLinks?: boolean }) {
  const services = await loadPublicServices();
  return <ServiceGrid services={services} bookLinks={bookLinks} />;
}
