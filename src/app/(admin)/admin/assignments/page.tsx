import { Suspense } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { AssignPanel } from "@/components/matching/assign-panel";
import { ForemanDecision } from "@/components/matching/foreman-decision";
import { EmptyState } from "@/components/ui/empty-state";
import { adminChoices, processExpiredOffers } from "@/lib/matching/engine";
import { dayAndTime } from "@/lib/matching/format";
import { createAdminClient } from "@/lib/supabase/admin";
import styles from "@/components/matching/matching.module.css";

export default function AssignmentsPage() {
  return <Suspense fallback={<p role="status">Loading assignments…</p>}><Assignments /></Suspense>;
}

type WaitingJob = {
  id: string; is_urgent: boolean; job_class: string | null; needs_admin_reason: string | null; miss_count: number;
  created_at: string; preferred_start: string | null; description: string | null;
  services: { name: string } | null; addresses: { barangay: string | null; city: string } | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
};

type ChangeRequest = {
  id: string; booking_id: string; reason: string; created_at: string; current_foreman_id: string | null;
  bookings: { services: { name: string } | null } | null;
};

type PendingOffer = {
  id: string; booking_id: string; kind: string; expires_at: string; created_at: string;
  profiles: { first_name: string | null; last_name: string | null } | null;
  bookings: { services: { name: string } | null; addresses: { barangay: string | null; city: string } | null } | null;
};

type AssignedJob = {
  id: string; status: string; scheduled_start: string | null;
  services: { name: string } | null; addresses: { barangay: string | null; city: string } | null;
  provider: { first_name: string | null; last_name: string | null } | null;
};

const STATUS_WORDS: Record<string, string> = {
  accepted: "Accepted, waiting for a quote", quoted: "Quote sent", deposit_paid: "Deposit paid", scheduled: "Scheduled",
  on_the_way: "Provider on the way", in_progress: "Work in progress",
};

const fullName = (p: { first_name: string | null; last_name: string | null } | null, fallback: string) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(" ") || fallback;

async function Assignments() {
  const admin = createAdminClient();
  await processExpiredOffers(undefined, admin).catch((error) => console.error("expiry on assignments page failed", error));

  const [{ data: jobs }, { data: requests }, { data: pending }, { data: assigned }] = await Promise.all([
    admin.from("bookings")
      .select("id,is_urgent,job_class,needs_admin_reason,miss_count,created_at,preferred_start,description,services(name),addresses(barangay,city),profiles!bookings_customer_id_fkey(first_name,last_name)")
      .eq("status", "open").or("needs_admin.eq.true,job_class.eq.major,is_urgent.eq.false").order("created_at")
      .returns<WaitingJob[]>(),
    admin.from("foreman_change_requests")
      .select("id,booking_id,reason,created_at,current_foreman_id,bookings(services(name))")
      .eq("status", "pending").order("created_at").returns<ChangeRequest[]>(),
    admin.from("offers")
      .select("id,booking_id,kind,expires_at,created_at,profiles!offers_provider_id_fkey(first_name,last_name),bookings(services(name),addresses(barangay,city))")
      .eq("status", "pending").order("expires_at").returns<PendingOffer[]>(),
    admin.from("bookings")
      .select("id,status,scheduled_start,services(name),addresses(barangay,city),provider:profiles!bookings_provider_id_fkey(first_name,last_name)")
      .in("status", ["accepted", "quoted", "deposit_paid", "scheduled", "on_the_way", "in_progress"])
      .not("provider_id", "is", null).order("created_at", { ascending: false }).limit(30)
      .returns<AssignedJob[]>(),
  ]);

  const jobChoices = await Promise.all((jobs ?? []).map(async (job) => [job.id, await adminChoices(job.id, admin).catch(() => [])] as const));
  const choicesFor = new Map(jobChoices);
  const requestChoices = await Promise.all((requests ?? []).map(async (r) => [r.id, await adminChoices(r.booking_id, admin).catch(() => [])] as const));
  const requestOptions = new Map(requestChoices);

  const empty = (jobs ?? []).length === 0 && (requests ?? []).length === 0 && (pending ?? []).length === 0 && (assigned ?? []).length === 0;
  return (
    <section className={styles.stack}>
      <PageHeading title="Assignments" description="Choose a provider for each new job from the ranked list, and decide foreman change requests." />
      {empty && <EmptyState title="Nothing is waiting" description="New jobs, large jobs, jobs nobody accepted, and foreman change requests appear here." />}

      {(jobs ?? []).length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.heading}>Jobs waiting for a provider</h2>
          {(jobs ?? []).map((job) => (
            <article key={job.id} className={styles.card}>
              <div className={styles.head}>
                <span className={styles.name}>{job.services?.name ?? "Job"}</span>
                {job.job_class === "major" && <span className={styles.tag}>Large job: foreman</span>}
                {job.is_urgent && <span className={styles.urgent}>Urgent</span>}
              </div>
              <div className={styles.facts}>
                <span>Customer: {job.profiles?.first_name ?? "Customer"} {job.profiles?.last_name ?? ""}</span>
                <span>{[job.addresses?.barangay, job.addresses?.city].filter(Boolean).join(", ")}</span>
                <span>{job.preferred_start ? `Wanted ${dayAndTime(job.preferred_start)}` : "As soon as possible"}</span>
                {job.needs_admin_reason && <span>{job.needs_admin_reason}</span>}
                {job.miss_count > 0 && <span>{job.miss_count} declined or timed out</span>}
              </div>
              {job.description && <p>{job.description}</p>}
              <AssignPanel bookingId={job.id} options={choicesFor.get(job.id) ?? []} large={job.job_class === "major"} />
            </article>
          ))}
        </div>
      )}

      {(pending ?? []).length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.heading}>Offered, waiting for the provider to answer</h2>
          {(pending ?? []).map((offer) => (
            <article key={offer.id} className={styles.card}>
              <div className={styles.head}>
                <span className={styles.name}>{offer.bookings?.services?.name ?? "Job"}</span>
                <span className={styles.tag}>{offer.kind === "foreman" ? "Foreman offer" : "Offer sent"}</span>
              </div>
              <div className={styles.facts}>
                <span>Offered to {fullName(offer.profiles, "a provider")}</span>
                <span>{[offer.bookings?.addresses?.barangay, offer.bookings?.addresses?.city].filter(Boolean).join(", ")}</span>
                <span>Answer due {dayAndTime(offer.expires_at)}</span>
              </div>
              <p className={styles.muted}>If they decline or the time runs out, the job comes back to the list above so you can choose someone else.</p>
            </article>
          ))}
        </div>
      )}

      {(assigned ?? []).length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.heading}>Assigned jobs</h2>
          {(assigned ?? []).map((job) => (
            <article key={job.id} className={styles.card}>
              <div className={styles.head}>
                <span className={styles.name}>{job.services?.name ?? "Job"}</span>
                <span className={styles.tag}>{STATUS_WORDS[job.status] ?? job.status}</span>
              </div>
              <div className={styles.facts}>
                <span>Provider: {fullName(job.provider, "Provider")}</span>
                <span>{[job.addresses?.barangay, job.addresses?.city].filter(Boolean).join(", ")}</span>
                {job.scheduled_start && <span>{dayAndTime(job.scheduled_start)}</span>}
              </div>
            </article>
          ))}
        </div>
      )}

      {(requests ?? []).length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.heading}>Foreman change requests</h2>
          {(requests ?? []).map((request) => (
            <article key={request.id} className={styles.card}>
              <div className={styles.head}>
                <span className={styles.name}>{request.bookings?.services?.name ?? "Large job"}</span>
                <span className={styles.facts}>Asked {dayAndTime(request.created_at)}</span>
              </div>
              <p>“{request.reason}”</p>
              <ForemanDecision
                requestId={request.id}
                options={(requestOptions.get(request.id) ?? [])
                  .filter((o) => o.providerId !== request.current_foreman_id)
                  .map((o) => ({ providerId: o.providerId, label: `${o.name}${o.ranked ? "" : " (farther away)"}` }))}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
