import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusMessage } from "@/components/ui/status-message";
import { ApprovedSession } from "./approved-session";

export default function ProviderApplicationPage() {
  return (
    <Suspense fallback={<p role="status">Loading your provider application…</p>}>
      <ProviderApplicationStatusPage />
    </Suspense>
  );
}

export async function ProviderApplicationStatusPage() {
  await connection();
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login?next=/provider-application");
  const admin = createAdminClient();
  const [{ data: profile }, { data: application }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    admin.from("provider_profiles").select("status,rejection_reason,reviewed_at,service_area,daily_rate").eq("profile_id", user.id).maybeSingle(),
  ]);
  if (application?.status === "approved" && profile?.role === "provider") {
    if (user.app_metadata?.role === "provider") redirect("/provider");
    return <section><h1>Provider application status</h1><ApprovedSession /></section>;
  }
  if (!application) redirect("/provider-application/submit");
  if (application.status === "approved") redirect("/provider");
  const statusText = application.status === "pending" ? "Under review" : application.status === "rejected" ? "Not approved" : "Application paused";
  return <section>
    <h1>Provider application status</h1>
    <StatusMessage status={application.status === "rejected" ? "warning" : "info"}>{statusText}</StatusMessage>
    <p>Service area: {application.service_area ?? "Not provided"}</p>
    <p>Daily rate: PHP {application.daily_rate ?? "Not provided"}</p>
    {application.rejection_reason && <p>Admin message: {application.rejection_reason}</p>}
    {application.status === "pending" && <p>The admin team will review your application and send the decision here and by email.</p>}
    {application.status === "rejected" && <p>Your uploaded documents will be deleted 30 days after the decision when the scheduled cleanup job is configured.</p>}
    <Link href="/">Return to home</Link>
  </section>;
}
