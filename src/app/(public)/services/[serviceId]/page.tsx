import { connection } from "next/server";
import { notFound } from "next/navigation";
import { loadServiceDetails } from "@/lib/public/service-details";
import { ServiceShowcase } from "@/components/services/service-showcase";

export default async function PublicServicePage({ params }: { params: Promise<{ serviceId: string }> }) {
  await connection();
  const { serviceId } = await params;
  const { service, photos, reviews } = await loadServiceDetails(serviceId);
  if (!service) notFound();
  return <ServiceShowcase service={service} photos={photos} reviews={reviews} customer={false} />;
}
