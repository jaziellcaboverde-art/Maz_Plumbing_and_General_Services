import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadServiceDetails } from "@/lib/public/service-details";
import { ServiceShowcase } from "@/components/services/service-showcase";

export default async function CustomerServicePage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/customer/services/${serviceId}`)}`);
  const { service, photos, reviews } = await loadServiceDetails(serviceId);
  if (!service) notFound();
  return <ServiceShowcase service={service} photos={photos} reviews={reviews} customer />;
}
