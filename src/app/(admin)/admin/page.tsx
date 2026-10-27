import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeading } from "@/components/layout/page-heading";
import { QuoteDecision } from "@/components/quotes/quote-decision";
import { loadTierConfig } from "@/lib/quotes/config";
import { TIER_LABELS, formatPeso, paymentPlanText, paymentTierFor, type PaymentTier } from "@/lib/quotes/rules";
import quoteStyles from "@/components/quotes/quotes.module.css";
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

  const { data: proposed, error: quoteError } = await admin.from("quotes")
    .select("id,booking_id,amount,job_class,notes,created_at,profiles!quotes_proposed_by_fkey(first_name,last_name),bookings(is_major_renovation,services(name))")
    .eq("status", "proposed").order("created_at", { ascending: true });
  const quoteBookingIds = (proposed ?? []).map((q) => q.booking_id as string);
  const { data: allMilestones } = quoteBookingIds.length
    ? await admin.from("milestones").select("booking_id,position,title,amount").in("booking_id", quoteBookingIds).order("position")
    : { data: [] };
  const tierConfig = await loadTierConfig(admin);
  const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? value[0] ?? null : value);

  return <section className={styles.page}>
    <PageHeading title="Needs action" description="Quotes and provider applications waiting for an admin decision." />
    <section className={styles.section} aria-labelledby="quotes-title">
      <div className={styles.sectionHeader}>
        <h2 id="quotes-title">Quotes to approve</h2>
        {proposed?.length ? <span>{proposed.length} waiting</span> : null}
      </div>
      {quoteError && <p role="alert">Could not load quotes: {quoteError.message}</p>}
      {!proposed?.length && !quoteError && <p>No quotes are waiting for approval.</p>}
      {proposed?.length ? <ul className={styles.list}>
        {proposed.map((quote) => {
          const provider = one(quote.profiles as { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null);
          const booking = one(quote.bookings as { is_major_renovation: boolean; services: { name: string } | { name: string }[] | null } | { is_major_renovation: boolean; services: { name: string } | { name: string }[] | null }[] | null);
          const service = one(booking?.services ?? null);
          const amount = Number(quote.amount);
          const tier: PaymentTier = paymentTierFor(amount, quote.job_class === "major" || !!booking?.is_major_renovation, tierConfig);
          const rows = (allMilestones ?? []).filter((m) => m.booking_id === quote.booking_id);
          return <li key={quote.id} className={quoteStyles.card}>
            <div className={quoteStyles.head}>
              <span className={quoteStyles.title}>{service?.name ?? "Job"}: {formatPeso(amount)}</span>
              <span className={quoteStyles.tag}>{TIER_LABELS[tier]}</span>
            </div>
            <span className={quoteStyles.muted}>From {[provider?.first_name, provider?.last_name].filter(Boolean).join(" ") || "provider"}. Proposed class: {quote.job_class}. Sent {new Date(quote.created_at).toLocaleDateString()}</span>
            {quote.notes && <p>{quote.notes}</p>}
            <p className={quoteStyles.muted}>{paymentPlanText(amount, tier, tierConfig)}</p>
            {rows.length > 0 && <ul>{rows.map((m) => <li key={m.position}>{m.position}. {m.title}: {formatPeso(Number(m.amount))}</li>)}</ul>}
            <QuoteDecision quoteId={quote.id} proposedClass={quote.job_class === "major" ? "major" : "minor"} />
          </li>;
        })}
      </ul> : null}
    </section>
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
