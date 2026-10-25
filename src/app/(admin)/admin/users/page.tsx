import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeading } from "@/components/layout/page-heading";
import { UsersTable, type AdminUserRow } from "./users-table";
import styles from "./page.module.css";

export default function AdminUsersPage() {
  return <Suspense fallback={<p>Loading users…</p>}><AdminUsersContent /></Suspense>;
}

async function AdminUsersContent() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") redirect("/customer");

  const admin = createAdminClient();
  const [{ data: profiles, error: profileError }, { data: authUsers, error: authError }, { data: providers, error: providerError }] = await Promise.all([
    admin.from("profiles").select("id,role,first_name,last_name,mobile,created_at").order("created_at", { ascending: false }).limit(1000),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("provider_profiles").select("profile_id,status"),
  ]);

  const emailById = new Map((authUsers?.users ?? []).map((authUser) => [authUser.id, authUser.email ?? ""]));
  const providerById = new Map((providers ?? []).map((provider) => [provider.profile_id, provider.status]));
  const rows: AdminUserRow[] = (profiles ?? []).map((profile) => ({
    id: profile.id,
    name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unnamed user",
    email: emailById.get(profile.id) || "Email unavailable",
    mobile: profile.mobile || "Not provided",
    role: profile.role,
    providerStatus: providerById.get(profile.id) ?? null,
  }));
  const error = profileError?.message ?? authError?.message ?? providerError?.message;

  return <section className={styles.page}>
    <PageHeading title="Users" description="View account roles and manage provider departures." />
    {error && <p role="alert">Could not load all user details: {error}</p>}
    <UsersTable users={rows} />
  </section>;
}
