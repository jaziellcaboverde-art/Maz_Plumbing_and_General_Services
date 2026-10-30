import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PageHeading } from "@/components/layout/page-heading";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CustomersTable, type CustomerRow } from "./customers-table";
import styles from "./page.module.css";

const STAGES: { title: string; statuses: string[] }[] = [
  { title: "Requests", statuses: ["draft", "open", "offered"] },
  { title: "Confirmed", statuses: ["accepted", "quoted", "deposit_paid", "scheduled"] },
  { title: "In progress", statuses: ["on_the_way", "in_progress"] },
  { title: "Closed", statuses: ["done", "signed", "balance_paid", "completed", "cancelled"] },
];

export default async function AdminCustomersPage() {
  await connection();
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");

  const { data: actor } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") redirect("/customer");

  const admin = createAdminClient();
  const [{ data: profiles, error }, { data: bookings, error: bookingError }, { data: authUsers }] = await Promise.all([
    admin.from("profiles").select("id,first_name,last_name,business_name,account_type,mobile,created_at").eq("role", "customer").order("created_at", { ascending: false }).limit(1000),
    admin.from("bookings").select("id,customer_id,status,updated_at,services:services!bookings_service_id_fkey(name)").order("updated_at", { ascending: false }).limit(2000),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const emailById = new Map((authUsers?.users ?? []).map((authUser) => [authUser.id, authUser.email ?? ""]));
  // Bookings arrive newest first, so the first one seen for a customer is their latest.
  const byCustomer = new Map<string, NonNullable<typeof bookings>>();
  for (const booking of bookings ?? []) {
    const list = byCustomer.get(booking.customer_id) ?? [];
    list.push(booking);
    byCustomer.set(booking.customer_id, list);
  }

  const customers: CustomerRow[] = (profiles ?? []).map((profile) => {
    const contactName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
    const projects = byCustomer.get(profile.id) ?? [];
    const latest = projects[0] ?? null;
    return {
      id: profile.id,
      name: profile.business_name || contactName || "Unnamed customer",
      contactName: profile.business_name ? contactName : "",
      accountType: profile.account_type === "business" ? "business" : "household",
      email: emailById.get(profile.id) || "Email unavailable",
      mobile: profile.mobile || "Not provided",
      projectCount: projects.length,
      latestService: latest ? one(latest.services)?.name ?? "Service project" : null,
      latestStatus: latest?.status ?? null,
      latestStage: latest ? STAGES.find((stage) => stage.statuses.includes(latest.status))?.title ?? "Requests" : "No projects",
      lastActive: latest?.updated_at ?? profile.created_at,
    };
  });

  const loadError = error?.message ?? bookingError?.message;
  return <section className={styles.page}>
    <PageHeading title="Customers" description="One row per customer, with their projects and latest activity." />
    {loadError && <p role="alert">Could not load all customer details: {loadError}</p>}
    <CustomersTable customers={customers} />
  </section>;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
