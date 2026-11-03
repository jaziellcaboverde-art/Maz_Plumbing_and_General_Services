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
    typeof body?.reason !== "string" ||
    body.reason.trim().length < 10
  )
    return Response.json(
      { error: "Record the replacement or rescheduling plan." },
      { status: 400 },
    );
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await auth.session.rpc("release_provider_assignment", {
    p_assignment: id,
    p_reason: body.reason.slice(0, 1000),
  });
  return error
    ? databaseError(error, "Could not release this assignment.")
    : Response.json({ ok: true });
}
