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
    typeof body?.leadId !== "string" ||
    !UUID.test(body.leadId)
  )
    return Response.json(
      { error: "Select an accepted lead provider." },
      { status: 400 },
    );
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await auth.session.rpc("confirm_maz_appointment", {
    p_booking: id,
    p_lead: body.leadId,
  });
  return error
    ? databaseError(error, "Could not confirm the appointment.")
    : Response.json({ ok: true });
}
