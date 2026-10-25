import { deliverNotifications } from "@/lib/matching/engine";
import { databaseError, readBody, requireUser, UUID } from "@/lib/matching/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  const providerId = typeof body?.providerId === "string" ? body.providerId : "";
  if (!UUID.test(id) || !UUID.test(providerId)) return Response.json({ error: "Choose a provider." }, { status: 400 });
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.session.rpc("admin_offer", { p_booking_id: id, p_provider_id: providerId });
  if (error) return databaseError(error, "Could not assign the provider. Try again.");
  await deliverNotifications((data as { notify?: unknown } | null)?.notify);
  return Response.json({ ok: true });
}
