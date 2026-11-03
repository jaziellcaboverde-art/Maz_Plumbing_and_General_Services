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
  if (!UUID.test(id) || typeof body?.accept !== "boolean")
    return Response.json(
      { error: "Choose accept or decline." },
      { status: 400 },
    );
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.session.rpc(
    "respond_provider_assignment",
    {
      p_assignment: id,
      p_accept: body.accept,
      p_reason:
        typeof body.reason === "string" ? body.reason.slice(0, 500) : null,
    },
  );
  if (error) return databaseError(error, "Could not save your answer.");
  const { data: assignment } = await auth.session
    .from("provider_assignments")
    .select("booking_id")
    .eq("id", id)
    .maybeSingle();
  if (assignment)
    await notifyProviderSubmission(
      assignment.booking_id,
      "Provider responded to a team assignment",
    ).catch((error) =>
      console.error("assignment response notification", error),
    );
  return Response.json({ ok: true, ...data });
}
