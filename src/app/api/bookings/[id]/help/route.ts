import { createAdminClient } from "@/lib/supabase/admin";
import { tellAdmins } from "@/lib/matching/engine";
import { databaseError, readBody, requireUser, UUID } from "@/lib/matching/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Booking not found." }, { status: 404 });
  const body = await readBody(request);
  const note = typeof body?.note === "string" ? body.note.slice(0, 300) : null;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await auth.session.rpc("request_admin_help", { p_booking_id: id, p_note: note });
  if (error) return databaseError(error, "Could not ask for help. Try again.");
  try { await tellAdmins(id, createAdminClient(), false); } catch (e) { console.error("admin notice failed", e); }
  return Response.json({ ok: true });
}
