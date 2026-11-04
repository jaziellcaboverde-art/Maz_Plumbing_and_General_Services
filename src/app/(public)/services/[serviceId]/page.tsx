import { connection } from "next/server";
import { notFound } from "next/navigation";
import { loadServiceDetails } from "@/lib/public/service-details";
import { ServiceShowcase } from "@/components/services/service-showcase";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";

export default function PublicServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <PublicServiceContent params={params} />
    </Suspense>
  );
}

async function PublicServiceContent({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  await connection();
  const { serviceId } = await params;
  const { service, photos, reviews } = await loadServiceDetails(serviceId);
  if (!service) notFound();
  return (
    <ServiceShowcase
      service={service}
      photos={photos}
      reviews={reviews}
      customer={false}
    />
  );
}
