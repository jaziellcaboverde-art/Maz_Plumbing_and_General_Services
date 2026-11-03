import { ActionLink } from "@/components/ui/action-link";
import { Suspense } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { WorkUpdateList } from "@/components/provider/work-update-list";
import { providerSession } from "@/lib/provider/workspace";
import styles from "@/components/provider/workspace.module.css";
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading work updates...</p>}>
      <Updates />
    </Suspense>
  );
}
async function Updates() {
  const { client, user } = await providerSession();
  const { data, error } = await client
    .from("provider_work_updates")
    .select("*")
    .eq("provider_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <section className={styles.stack}>
      <PageHeading
        title="Job updates"
        description="Your inspection findings, work evidence, change requests and MAZ decisions."
        trailing={
          <ActionLink href="/provider/jobs">Open an assignment to submit</ActionLink>
        }
      />
      {error ? (
        <p role="alert">Could not load updates.</p>
      ) : (
        <WorkUpdateList updates={data ?? []} />
      )}
    </section>
  );
}
