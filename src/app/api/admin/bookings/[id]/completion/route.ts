import { databaseError, requireUser, UUID } from "@/lib/matching/http";
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID.test(id))
    return Response.json({ error: "Invalid booking." }, { status: 400 });
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await auth.session.rpc(
    "approve_provider_project_completion",
    { p_booking: id },
  );
  return error
    ? databaseError(error, "Could not approve project completion.")
    : Response.json({ ok: true });
}
