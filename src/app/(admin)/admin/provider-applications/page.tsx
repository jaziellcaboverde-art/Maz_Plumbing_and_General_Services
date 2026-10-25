import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeading } from "@/components/layout/page-heading";
import { ProviderApplicationQueue } from "./provider-application-queue";
import styles from "./page.module.css";

export default function ProviderApplicationsPage() {
  return <Suspense fallback={<p>Loading provider applications…</p>}><ProviderApplicationsContent /></Suspense>;
}

async function ProviderApplicationsContent() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") redirect("/customer");
  const admin = createAdminClient();
  const { data: applications, error } = await admin
    .from("provider_profiles")
    .select("profile_id,created_at,reviewed_at,rejection_reason,service_area,daily_rate,status,profiles!provider_profiles_profile_id_fkey(first_name,last_name,mobile)")
    .in("status", ["pending", "approved", "rejected"])
    .order("created_at", { ascending: false })
    .limit(300);

  const queue = (applications ?? []).map((application) => {
    const profile = Array.isArray(application.profiles) ? application.profiles[0] : application.profiles;
    return {
      applicantId: application.profile_id,
      name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Applicant",
      mobile: profile?.mobile ?? "Not provided",
      serviceArea: application.service_area ?? "Not provided",
      dailyRate: application.daily_rate === null ? "Not provided" : String(application.daily_rate),
      submittedAt: new Date(application.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" }),
      reviewedAt: application.reviewed_at ? new Date(application.reviewed_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : null,
      rejectionReason: application.rejection_reason,
      status: application.status as "pending" | "approved" | "rejected",
    };
  });

  return <section className={styles.page}>
    <PageHeading title="Provider applications" description="Review provider applications and check recently recorded decisions." />
    {error && <p role="alert">Could not load applications: {error.message}</p>}
    {!error && <ProviderApplicationQueue applications={queue} />}
  </section>;
}
