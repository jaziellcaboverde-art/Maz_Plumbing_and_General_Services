import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PageHeading } from "@/components/layout/page-heading";
import { AskHelpButton } from "@/components/matching/ask-help-button";
import { ProviderPickList, type PickOption } from "@/components/matching/provider-pick-list";
import { EmptyState } from "@/components/ui/empty-state";
import { loadRankingConfig, processExpiredOffers, rankedCandidates } from "@/lib/matching/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default function ChoosePage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p role="status">Finding providers near you…</p>}><Choose params={params} /></Suspense>;
}

async function Choose({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/customer/bookings/${id}/choose`);

  const { data: owned } = await supabase.from("bookings").select("id").eq("id", id).eq("customer_id", user.id).maybeSingle();
  if (!owned) notFound();

  const admin = createAdminClient();
  await processExpiredOffers(id, admin);
  const { data: booking } = await admin.from("bookings")
    .select("status,is_urgent,job_class,needs_admin,services(name)").eq("id", id)
    .returns<Array<{ status: string; is_urgent: boolean; job_class: string | null; needs_admin: boolean; services: { name: string } | null }>>().maybeSingle();
  if (!booking) notFound();
  // Only a normal job that is waiting for a pick belongs on this screen.
  if (booking.status !== "open" || booking.is_urgent || booking.job_class === "major") redirect(`/customer/bookings/${id}`);

  const [ranked, config] = await Promise.all([rankedCandidates(id, admin), loadRankingConfig(admin)]);
  const options: PickOption[] = ranked.slice(0, config.listSize).map((c) => ({
    providerId: c.providerId,
    name: `${c.firstName} ${c.lastInitial}`.trim(),
    stars: c.stars,
    reviewCount: c.reviewCount,
    finishedJobs: c.finishedJobs,
    distanceM: c.distanceM,
    dailyRate: c.dailyRate,
    isNew: c.isNew,
    isFar: c.isFar,
  }));

  return (
    <section>
      <PageHeading title="Choose a provider" description={booking.services?.name ?? undefined} />
      {booking.needs_admin && <p>Our team is looking for a provider for you. You can still choose one below.</p>}
      {options.length === 0 ? (
        <EmptyState
          title="No provider is available near you right now"
          description="Our team can look for someone for you and will let you know."
          action={booking.needs_admin ? undefined : <AskHelpButton bookingId={id} />}
        />
      ) : (
        <ProviderPickList bookingId={id} options={options} />
      )}
      <p><Link href={`/customer/bookings/${id}`}>Back to this booking</Link></p>
    </section>
  );
}
