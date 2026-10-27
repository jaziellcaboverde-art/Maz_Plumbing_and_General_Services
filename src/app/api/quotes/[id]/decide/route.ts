import { deliverNotifications } from "@/lib/matching/engine";
import { databaseError, readBody, requireUser, UUID } from "@/lib/matching/http";

/** Step 9.4: an admin approves the class and price, or sends the quote back with a reason. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  if (!UUID.test(id) || typeof body?.approve !== "boolean") return Response.json({ error: "Choose approve or send back." }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
  const jobClass = body.jobClass === "minor" || body.jobClass === "major" ? body.jobClass : null;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.session.rpc("decide_quote", {
    p_quote_id: id, p_approve: body.approve, p_note: note, p_class: jobClass,
  });
  if (error) return databaseError(error, "Could not save the decision. Try again.");
  const result = data as { outcome?: string; notify?: unknown } | null;
  await deliverNotifications(result?.notify);
  return Response.json({ ok: true, outcome: result?.outcome ?? null });
}
