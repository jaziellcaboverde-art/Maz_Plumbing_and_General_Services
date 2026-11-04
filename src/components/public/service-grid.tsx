import { ServiceCardLink } from "@/components/services/service-card-link";
import { ServiceImage } from "@/components/services/service-image";
import { loadPublicServices } from "@/lib/public/load-services";
import type { PublicService } from "@/lib/public/launch-services";
import { servicePath } from "@/lib/public/service-path";
import { ServiceIcon } from "./service-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusMessage } from "@/components/ui/status-message";
import styles from "./service-grid.module.css";

/** Cards open the portfolio and reviews before booking. */
export function ServiceGrid({
  services,
  bookLinks = false,
}: {
  services: readonly PublicService[];
  bookLinks?: boolean;
}) {
  if (!services.length)
    return (
      <EmptyState
        title="No services available yet."
        description="Please check back for services published by MAZ."
      />
    );
  return (
    <ul className={styles.services}>
      {services.map((service) => (
        <li key={`${service.category}-${service.name}`}>
          <ServiceCardLink
            name={service.name}
            customer={bookLinks}
            className={styles.service}
            href={servicePath(service, bookLinks)}
          >
            {service.imageUrl && (
              <ServiceImage
                className={styles.cover}
                src={service.imageUrl}
                alt={`${service.name} service`}
              />
            )}
            <span className={styles.serviceIcon}>
              <ServiceIcon category={service.category} />
            </span>
            <p className={styles.serviceCategory}>{service.category}</p>
            <h3 className={styles.serviceName}>{service.name}</h3>
            {service.description && (
              <p className={styles.serviceText}>{service.description}</p>
            )}
            <p className={styles.price}>
              {service.startingPricePhp == null
                ? "Price on quotation"
                : `From ${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(service.startingPricePhp)}`}
            </p>
            {service.priceNote && (
              <p className={styles.serviceText}>{service.priceNote}</p>
            )}
            <span className={styles.bookLink}>
              View portfolio &amp; customer reviews
            </span>
          </ServiceCardLink>
        </li>
      ))}
    </ul>
  );
}

export async function LiveServices({
  bookLinks = false,
}: {
  bookLinks?: boolean;
}) {
  const services = await loadPublicServices().catch(() => null);
  if (!services) {
    return (
      <StatusMessage status="error">
        Services could not be loaded. Please refresh or try again shortly.
      </StatusMessage>
    );
  }
  return <ServiceGrid services={services} bookLinks={bookLinks} />;
}
