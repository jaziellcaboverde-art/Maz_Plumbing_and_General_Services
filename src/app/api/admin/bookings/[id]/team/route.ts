import { deliverNotifications } from "@/lib/matching/engine";
import {
  databaseError,
  readBody,
  requireUser,
  UUID,
} from "@/lib/matching/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await readBody(request);
  if (
    !UUID.test(id) ||
    typeof body?.providerId !== "string" ||
    !UUID.test(body.providerId) ||
    typeof body.trade !== "string" ||
    body.trade.trim().length < 2 ||
    body.trade.length > 120 ||
    !["inspection", "execution"].includes(String(body.phase)) ||
    ![body.startsAt, body.endsAt, body.expiresAt].every(
      (v) => typeof v === "string" && Number.isFinite(Date.parse(v)),
    ) ||
    (body.travelMinutes !== undefined &&
      (!Number.isInteger(body.travelMinutes) ||
        Number(body.travelMinutes) < 0 ||
        Number(body.travelMinutes) > 240))
  ) {
    return Response.json(
      {
        error:
          "Provide the worker, role, phase, work period and offer deadline.",
      },
      { status: 400 },
    );
  }
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.session.rpc("offer_provider_assignment", {
    p_booking: id,
    p_provider: body.providerId,
    p_trade: body.trade,
    p_phase: body.phase,
    p_start: body.startsAt,
    p_end: body.endsAt,
    p_expires: body.expiresAt,
    p_buffer: body.travelMinutes ?? 30,
  });
  if (error) return databaseError(error, "Could not offer the assignment.");
  await deliverNotifications(data?.notify);
  return Response.json({ ok: true, assignment: data?.assignment });
}
