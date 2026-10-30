import { deliverNotifications } from "@/lib/matching/engine";
import { databaseError, readBody, requireUser, UUID } from "@/lib/matching/http";

/** 10.1: the provider confirms (or changes) the day and time of the job. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  const start = typeof body?.start === "string" ? new Date(body.start) : null;
  if (!UUID.test(id) || !start || Number.isNaN(start.getTime())) return Response.json({ error: "Pick a day and time." }, { status: 400 });
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.session.rpc("confirm_schedule", { p_booking_id: id, p_start: start.toISOString() });
  if (error) return databaseError(error, "Could not save the schedule. Try again.");
  await deliverNotifications((data as { notify?: unknown } | null)?.notify);
  return Response.json({ ok: true });
}
