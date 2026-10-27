import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { STATUS_LABELS, type BookingStatus } from "@/lib/booking/rules";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/quotes/quotes.module.css";

export default function ProviderJobs() {
  return <Suspense fallback={<p role="status">Loading your jobs…</p>}><Jobs /></Suspense>;
}

type Row = {
  id: string; status: BookingStatus; description: string | null; job_class: "minor" | "major" | null;
  is_major_renovation: boolean; services: { name: string } | null;
};

async function Jobs() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/provider/jobs");
  const { data, error } = await supabase.from("bookings")
    .select("id,status,description,job_class,is_major_renovation,services(name)")
    .eq("provider_id", user.id).neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .returns<Row[]>();
  if (error) return <p role="alert">Could not load your jobs. Refresh the page to try again.</p>;
  const rows = data ?? [];

  return (
    <section className={styles.stack}>
      <PageHeading title="Jobs" description="Jobs you accepted. Send quotes here." />
      {rows.length === 0 ? (
        <EmptyState title="No jobs yet" description="When you accept an offer, the job shows up here so you can quote it." />
      ) : (
        <ul className={styles.stack} aria-label="Your jobs">
          {rows.map((job) => (
            <li key={job.id} className={styles.card}>
              <div className={styles.head}>
                <span className={styles.title}>{job.services?.name ?? "Job"}</span>
                <span className={styles.tag}>{STATUS_LABELS[job.status]}</span>
              </div>
              {job.description && <p className={styles.muted}>{job.description}</p>}
              <p><Link href={`/provider/jobs/${job.id}`}>{job.status === "accepted" ? "Send a quote" : "Open job"}</Link></p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
