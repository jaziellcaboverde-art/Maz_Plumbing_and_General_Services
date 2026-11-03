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
    typeof body?.title !== "string" ||
    body.title.trim().length < 3 ||
    body.title.length > 120 ||
    (body.dueAt != null &&
      (typeof body.dueAt !== "string" ||
        !Number.isFinite(Date.parse(body.dueAt))))
  )
    return Response.json(
      { error: "Add a work milestone title and valid due date." },
      { status: 400 },
    );
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await auth.session.rpc("add_provider_work_milestone", {
    p_booking: id,
    p_title: body.title,
    p_due: body.dueAt ?? null,
  });
  return error
    ? databaseError(error, "Could not add milestone.")
    : Response.json({ ok: true });
}
