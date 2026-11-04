import { loadServiceDetails } from "@/lib/public/service-details";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ serviceId: string }> },
) {
  const { serviceId } = await params;
  try {
    const details = await loadServiceDetails(serviceId);
    return Response.json(details, {
      status: details.service ? 200 : 404,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Could not load this service. Please try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
