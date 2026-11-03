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
    typeof body?.reason !== "string" ||
    body.reason.trim().length < 10
  )
    return Response.json(
      { error: "Explain why replacement or rescheduling is needed." },
      { status: 400 },
    );
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await auth.session.rpc("request_provider_withdrawal", {
    p_assignment: id,
    p_reason: body.reason.slice(0, 1000),
  });
  if (error) return databaseError(error, "Could not request a replacement.");
  const { data } = await auth.session
    .from("provider_assignments")
    .select("booking_id")
    .eq("id", id)
    .maybeSingle();
  if (data)
    await notifyProviderSubmission(
      data.booking_id,
      "Provider replacement requested",
    ).catch(console.error);
  return Response.json({ ok: true });
}
