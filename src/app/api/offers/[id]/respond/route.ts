import { deliverNotifications, offerNextBest, tellAdmins } from "@/lib/matching/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { databaseError, readBody, requireUser, UUID } from "@/lib/matching/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  if (!UUID.test(id) || typeof body?.accept !== "boolean") return Response.json({ error: "Choose accept or decline." }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 300) : null;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.session.rpc("respond_to_offer", { p_offer_id: id, p_accept: body.accept, p_reason: reason });
  if (error) return databaseError(error, "Could not save your answer. Try again.");
  const result = data as { outcome?: string; next?: string; booking_id?: string; notify?: unknown } | null;
  await deliverNotifications(result?.notify);

  // The customer's decision is already saved. If the next offer fails, the worker picks it up later.
  try {
    const admin = createAdminClient();
    if (result?.booking_id && result.next === "auto") await offerNextBest(result.booking_id, admin);
    if (result?.booking_id && result.next === "admin") await tellAdmins(result.booking_id, admin, false);
  } catch (e) { console.error("could not continue after the answer", e); }
  return Response.json({ ok: true, outcome: result?.outcome ?? "declined" });
}

