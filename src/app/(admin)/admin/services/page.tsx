import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/layout/page-heading";
import { ServiceCatalog } from "./service-catalog";
import styles from "./page.module.css";

export default function AdminServicesPage() {
  return <Suspense fallback={<p>Loading service catalog…</p>}><AdminServicesContent /></Suspense>;
}

async function AdminServicesContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") redirect("/customer");
  const { data: services, error } = await supabase.from("services")
    .select("id,category,name,default_class,urgent_allowed,active,sort_order,description,starting_price_php,price_note")
    .order("sort_order").order("category").order("name");
  const catalog = (services ?? []).map((service) => ({
    ...service,
    starting_price_php: service.starting_price_php == null ? null : Number(service.starting_price_php),
  }));
  return <section className={styles.page}>
    <PageHeading title="Service catalog" description="Add the services confirmed for launch. Inactive services stay in past booking records but cannot be selected for new work." />
    {error && <p role="alert">Could not load services: {error.message}</p>}
    <ServiceCatalog initialServices={catalog} />
  </section>;
}
