import { redirect } from "next/navigation";
import { PageHeading } from "@/components/layout/page-heading";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ProjectTable, type ProjectRow } from "./project-table";
import styles from "./page.module.css";
import Link from "next/link";

export default async function AdminBookingsPage() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");

  const { data: actor } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") redirect("/customer");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select(`
      id,status,description,updated_at,
      services:services!bookings_service_id_fkey(name),
      customer:profiles!bookings_customer_id_fkey(first_name,last_name,business_name,account_type),
      provider:profiles!bookings_provider_id_fkey(first_name,last_name),
      picked_provider:profiles!bookings_picked_provider_id_fkey(first_name,last_name)
    `)
    .order("updated_at", { ascending: false })
    .limit(200);

  const projects: ProjectRow[] = (data ?? []).map((booking) => {
    const customer = one(booking.customer);
    const provider = one(booking.provider) ?? one(booking.picked_provider);
    const service = one(booking.services);
    const contactName = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ");
    return {
      id: booking.id,
      status: booking.status,
      customer: customer?.business_name || contactName || "Customer",
      customerDetail: customer?.business_name ? contactName || "Business account" : "Household account",
      service: service?.name || "Service project",
      description: booking.description || "No project details provided",
      provider: [provider?.first_name, provider?.last_name].filter(Boolean).join(" ") || "Unassigned",
      updatedAt: booking.updated_at,
    };
  });

  return <section className={styles.page}>
    <PageHeading
      title="Customer project progress"
      description="Track each service project by customer, current stage, assigned provider, and latest update."
      trailing={<Link className={styles.scheduleLink} href="/admin/provider-schedules">Provider schedules</Link>}
    />
    {error ? <p role="alert">Could not load customer projects: {error.message}</p> : <ProjectTable projects={projects} />}
  </section>;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
