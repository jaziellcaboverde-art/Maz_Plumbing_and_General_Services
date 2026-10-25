import { deliverNotifications } from "@/lib/matching/engine";
import { databaseError, readBody, requireUser, UUID } from "@/lib/matching/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Booking not found." }, { status: 404 });
  const body = await readBody(request);
  const reason = typeof body?.reason === "string" ? body.reason : "";
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.session.rpc("request_foreman_change", { p_booking_id: id, p_reason: reason });
  if (error) return databaseError(error, "Could not send your request. Try again.");
  await deliverNotifications((data as { notify?: unknown } | null)?.notify);
  return Response.json({ ok: true });
}
