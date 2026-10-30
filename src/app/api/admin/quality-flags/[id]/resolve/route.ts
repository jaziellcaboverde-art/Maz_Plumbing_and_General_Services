import { databaseError, readBody, requireUser, UUID } from "@/lib/matching/http";

/** An admin closes a provider quality flag and records what they did about it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!UUID.test(id) || note.length < 5 || note.length > 500) {
    return Response.json({ error: "Write what you did about it (5 to 500 characters)." }, { status: 400 });
  }
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await auth.session.rpc("resolve_quality_flag", { p_flag_id: id, p_note: note });
  if (error) return databaseError(error, "Could not close the flag. Try again.");
  return Response.json({ ok: true });
}
