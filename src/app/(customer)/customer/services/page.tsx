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
  return <ul style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,16rem),1fr))",gap:"1rem",listStyle:"none",padding:0}}>
    {services.map(service => <li key={`${service.category}-${service.name}`} style={{padding:"1.25rem",border:"1px solid var(--color-divider)",borderRadius:"0.75rem"}}>
      <h2 style={{fontSize:"1.15rem"}}>{service.name}</h2>
      <p>{service.description}</p>
      <Link href={service.id ? `/customer/services/${service.id}` : "/customer/bookings/new"}>View service details</Link>
    </li>)}
  </ul>;
}
