import {
  databaseError,
  readBody,
  requireAdmin,
  UUID,
} from "@/lib/matching/http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await readBody(request);
  const ids = body?.leadIds;
  if (
    !UUID.test(id) ||
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 50 ||
    ids.some((id) => typeof id !== "string" || !UUID.test(id)) ||
    new Set(ids).size !== ids.length
  )
    return Response.json(
      { error: "Select the assigned workers." },
      { status: 400 },
    );
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { error } = await auth.session.rpc("confirm_maz_team_appointment", {
    p_booking: id,
    p_workers: ids,
  });
  if (error?.code === "PGRST202")
    return Response.json(
      {
        error: "Team confirmation requires database migration 20261105020000.",
      },
      { status: 503 },
    );
  return error
    ? databaseError(error, "Could not confirm the appointment.")
    : Response.json({ ok: true });
}
