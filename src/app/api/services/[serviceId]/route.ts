import { loadServiceDetails } from "@/lib/public/service-details";

export async function GET(_request: Request, { params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const details = await loadServiceDetails(serviceId);
  return Response.json(details, { status: details.service ? 200 : 404 });
}
