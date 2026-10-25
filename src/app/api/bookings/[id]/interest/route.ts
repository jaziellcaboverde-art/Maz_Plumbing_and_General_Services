import { deliverNotifications } from "@/lib/matching/engine";
import { databaseError, readBody, requireUser, UUID } from "@/lib/matching/http";

/** A provider says "I can do this" for an open job, or takes it back. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Request not found." }, { status: 404 });
  const body = await readBody(request);
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.session.rpc("set_job_interest", { p_booking_id: id, p_interested: body?.interested !== false });
  if (error) return databaseError(error, "Could not save your answer. Try again.");
  const result = data as { interested?: boolean; notify?: unknown } | null;
  await deliverNotifications(result?.notify);
  return Response.json({ ok: true, interested: result?.interested === true });
}
