import { ActionLink } from "@/components/ui/action-link";
import styles from "./list.module.css";
import { Suspense } from "react";
import { LAUNCH_SERVICES } from "@/lib/public/launch-services";
import { workflowSession } from "@/lib/workflow/session";
import { PageHeading } from "@/components/layout/page-heading";
import { Wrench, CalendarPlus } from "lucide-react";
import Link from "next/link";

export default function CustomerServicesPage() {
  return (
    <section className={styles.page}>
      <PageHeading
        title="Services"
        description="Explore our services and choose the help you need."
        trailing={
          <ActionLink href="/customer/bookings/new">Book a service</ActionLink>
        }
      />
      <Suspense fallback={<p>Loading services…</p>}>
        <ServiceList />
      </Suspense>
    </section>
  );
}
async function ServiceList() {
  const { client } = await workflowSession("customer");
  const { data, error } = await client
    .from("services")
    .select("id,name,category,description")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error)
    return (
      <p role="alert">
        Services could not be loaded. Please refresh and try again.
      </p>
    );
  if (!data?.length)
    return <p>No services are available for booking right now.</p>;
  const descriptions = new Map(
    LAUNCH_SERVICES.map((service) => [service.name, service.description]),
  );
  const services = data.map((service) => ({
    ...service,
    description:
      service.description?.trim() || descriptions.get(service.name) || "",
  }));
  return (
    <ul className={styles.list}>
      {services.map((service) => (
        <li key={service.id ?? service.name} className={styles.card}>
          <div className={styles.cardHeading}>
            <Wrench aria-hidden="true" className={styles.icon} />
            <span className={styles.category}>{service.category}</span>
          </div>
          <h2 className={styles.title}>{service.name}</h2>
          <p>{service.description}</p>
          <div className={styles.actions}>
            <Link
              className={styles.bookButton}
              aria-label={`Book ${service.name}`}
              title={`Book ${service.name}`}
              href={
                "/customer/bookings/new" +
                "?" +
                new URLSearchParams(
                  service.id
                    ? { service: service.id }
                    : { serviceName: service.name, category: service.category },
                ).toString()
              }
            >
              <CalendarPlus aria-hidden="true" />
            </Link>
            {service.id && (
              <ActionLink href={"/customer/services/" + service.id}>
                View details
              </ActionLink>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
