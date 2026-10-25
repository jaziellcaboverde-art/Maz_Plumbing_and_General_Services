import { deliverNotifications } from "@/lib/matching/engine";
import { databaseError, readBody, requireUser, UUID } from "@/lib/matching/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  if (!UUID.test(id) || typeof body?.approve !== "boolean") return Response.json({ error: "Approve or decline the request." }, { status: 400 });
  const newProviderId = typeof body.newProviderId === "string" && UUID.test(body.newProviderId) ? body.newProviderId : null;
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : null;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.session.rpc("decide_foreman_change", {
    p_request_id: id, p_approve: body.approve, p_note: note, p_new_provider_id: newProviderId,
  });
  if (error) return databaseError(error, "Could not save the decision. Try again.");
  await deliverNotifications((data as { notify?: unknown } | null)?.notify);
  return Response.json({ ok: true });
}
