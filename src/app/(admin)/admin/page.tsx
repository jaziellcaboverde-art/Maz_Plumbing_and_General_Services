import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarDays, ClipboardCheck, Users, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeading } from "@/components/layout/page-heading";
import styles from "./needs-action.module.css";

export default function AdminHome() {
  return <Suspense fallback={<p role="status">Loading dashboard…</p>}><AdminDashboard /></Suspense>;
}

async function AdminDashboard() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") redirect("/customer");

  const admin = createAdminClient();
  const [applicationsResult, pendingResult, urgentResult, unassignedResult, paymentResult] = await Promise.all([
    admin.from("provider_profiles")
      .select("profile_id,created_at,service_area,daily_rate,profiles!provider_profiles_profile_id_fkey(first_name,last_name)")
      .eq("status", "pending").order("created_at", { ascending: true }).limit(5),
    admin.from("bookings").select("id", { count: "exact", head: true }).in("status", ["open", "offered"]),
    admin.from("bookings").select("id", { count: "exact", head: true }).eq("is_urgent", true).in("status", ["open", "offered", "accepted"]),
    admin.from("bookings").select("id", { count: "exact", head: true }).is("provider_id", null).in("status", ["open", "offered", "accepted"]),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const applications = applicationsResult.data;

  return <section className={styles.page}>
    <PageHeading title="Dashboard" description="Review requests that need attention and continue the next operational step." />

    <div className={styles.metrics} aria-label="Operational summary">
      <Link href="/admin/bookings" className={styles.metric}><ClipboardCheck aria-hidden="true" /><span><strong>{pendingResult.count ?? 0}</strong><small>Pending requests</small></span></Link>
      <Link href="/admin/bookings" className={styles.metric}><AlertTriangle aria-hidden="true" /><span><strong>{urgentResult.count ?? 0}</strong><small>Urgent requests</small></span></Link>
      <Link href="/admin/assignments" className={styles.metric}><Users aria-hidden="true" /><span><strong>{unassignedResult.count ?? 0}</strong><small>Need provider</small></span></Link>
      <Link href="/admin/payments" className={styles.metric}><Wallet aria-hidden="true" /><span><strong>{paymentResult.count ?? 0}</strong><small>Payments to review</small></span></Link>
    </div>

    <section className={styles.quickActions} aria-labelledby="quick-actions-title">
      <div className={styles.sectionHeader}><h2 id="quick-actions-title">Quick actions</h2></div>
      <div className={styles.actionGrid}>
        <Link href="/admin/create-booking"><ClipboardCheck aria-hidden="true" /><span><strong>Create booking</strong><small>Encode a phone, Facebook, walk-in or referral request.</small></span></Link>
        <Link href="/admin/provider-schedules"><CalendarDays aria-hidden="true" /><span><strong>Provider calendar</strong><small>Check availability and possible schedule conflicts.</small></span></Link>
        <Link href="/admin/assignments"><Users aria-hidden="true" /><span><strong>Assign provider</strong><small>Review qualified providers and active assignments.</small></span></Link>
        <Link href="/admin/payments"><Wallet aria-hidden="true" /><span><strong>Record payment</strong><small>Review and confirm externally received payments.</small></span></Link>
      </div>
    </section>

    <section className={styles.section} aria-labelledby="provider-applications-title">
      <div className={styles.sectionHeader}>
        <h2 id="provider-applications-title">Provider applications</h2>
        {applications?.length ? <span>{applications.length} shown</span> : null}
      </div>
      {applicationsResult.error && <p role="alert">Could not load provider applications.</p>}
      {!applications?.length && !applicationsResult.error && <p className={styles.muted}>No provider applications are waiting for review.</p>}
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
