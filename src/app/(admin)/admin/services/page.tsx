import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    .select("id,category,name,default_class,urgent_allowed,active,sort_order,description,starting_price_php,image_path")
    .order("active", { ascending: false }).order("sort_order").order("category").order("name");
  const admin = createAdminClient();
  const { data: logRows } = await admin.from("audit_log").select("id,actor_id,action,reason,details,created_at")
    .eq("target_table", "services").order("created_at", { ascending: false }).limit(50);
  const actorIds = [...new Set((logRows ?? []).map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
  const { data: actors } = actorIds.length ? await admin.from("profiles").select("id,first_name,last_name").in("id", actorIds) : { data: [] };
  const actorName = new Map((actors ?? []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || "Admin"]));
  const initialLog = (logRows ?? []).map((row) => ({
    id: String(row.id),
    actor: row.actor_id ? actorName.get(row.actor_id) ?? "Admin" : "System",
    action: String(row.action).replace("service.", ""),
    name: String((row.details as { name?: string } | null)?.name ?? ""),
    reason: row.reason as string | null,
    at: row.created_at as string,
  }));
  const photoBase = supabase.storage.from("service-photos").getPublicUrl("").data.publicUrl;
  return <section className={styles.page}>
    <PageHeading title="Service catalog" description="Each card is a service. Click a card to open it." />
    {error && <p role="alert">Could not load services: {error.message}</p>}
    <ServiceCatalog initialServices={services ?? []} photoBase={photoBase} initialLog={initialLog} />
  </section>;
}
