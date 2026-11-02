import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/layout/page-heading";
import { ProviderRequirementsForm } from "./provider-requirements-form";
import styles from "./page.module.css";

export default function AdminConfigPage() {
  return <Suspense fallback={<p>Loading configuration…</p>}><AdminConfigContent /></Suspense>;
}

async function AdminConfigContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: actor }, { data: nbiPolicy }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("config").select("value").eq("key", "provider.nbi_clearance_required").maybeSingle(),
  ]);
  if (actor?.role !== "admin") redirect("/customer");
  return <section className={styles.page}>
    <PageHeading title="Configuration" description="Manage provider hiring requirements and launch policies." />
    <section className={styles.section}>
      <h2>Provider hiring requirements</h2>
      <p>Collect NBI clearance only when it is part of the current hiring policy. Changes apply to new applications.</p>
      <ProviderRequirementsForm initialNbiRequired={nbiPolicy?.value === true} />
    </section>
  </section>;
}
