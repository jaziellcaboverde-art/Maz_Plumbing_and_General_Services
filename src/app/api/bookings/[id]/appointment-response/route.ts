import {
  databaseError,
  readBody,
  requireUser,
  UUID,
} from "@/lib/matching/http";
import { notifyProviderSubmission } from "@/lib/provider/notify";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await readBody(request);
  if (
    !UUID.test(id) ||
    typeof body?.proposalId !== "string" ||
    !UUID.test(body.proposalId) ||
    typeof body.accept !== "boolean"
  )
    return Response.json(
      { error: "Choose an appointment response." },
      { status: 400 },
    );
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data: proposal } = await auth.session
    .from("provider_appointment_requests")
    .select("id")
    .eq("id", body.proposalId)
    .eq("booking_id", id)
    .maybeSingle();
  if (!proposal)
    return Response.json(
      { error: "Appointment proposal not found." },
      { status: 404 },
    );
  const { error } = await auth.session.rpc("respond_provider_appointment", {
    p_request: body.proposalId,
    p_accept: body.accept,
  });
  if (error)
    return databaseError(error, "Could not save the appointment response.");
  await notifyProviderSubmission(
    id,
    "Customer responded to proposed appointment",
  ).catch(console.error);
  return Response.json({ ok: true });
}
