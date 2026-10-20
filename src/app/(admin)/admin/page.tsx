import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeading } from "@/components/layout/page-heading";
import styles from "./needs-action.module.css";

export default function AdminHome() {
  return <Suspense fallback={<p>Loading action queue…</p>}><NeedsAction /></Suspense>;
}

async function NeedsAction() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") redirect("/customer");

  const admin = createAdminClient();
  const { data: applications, error } = await admin.from("provider_profiles")
    .select("profile_id,created_at,service_area,daily_rate,profiles!provider_profiles_profile_id_fkey(first_name,last_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return <section className={styles.page}>
    <PageHeading title="Needs action" description="Provider applications waiting for an admin decision." />
    <section className={styles.section} aria-labelledby="provider-applications-title">
      <div className={styles.sectionHeader}>
        <h2 id="provider-applications-title">Provider applications</h2>
        {applications?.length ? <span>{applications.length} waiting</span> : null}
      </div>
      {error && <p role="alert">Could not load provider applications: {error.message}</p>}
      {!applications?.length && !error && <p>No provider applications are waiting for review.</p>}
      {applications?.length ? <ul className={styles.list}>
        {applications.map((application) => {
          const profile = Array.isArray(application.profiles) ? application.profiles[0] : application.profiles;
          const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Applicant";
          return <li key={application.profile_id}>
            <Link className={styles.application} href={`/admin/provider-applications/${application.profile_id}`}>
              <span className={styles.applicantName}>{name}</span>
              <span>{application.service_area || "Service area not provided"}</span>
              <span>PHP {application.daily_rate ?? "Not provided"} / day</span>
              <span>Submitted {new Date(application.created_at).toLocaleDateString()}</span>
            </Link>
          </li>;
        })}
      </ul> : null}
      <Link className={styles.allApplications} href="/admin/provider-applications">View all provider applications</Link>
    </section>
  </section>;
}
