import { deliverNotifications } from "@/lib/matching/engine";
import { databaseError, readBody, requireUser, UUID } from "@/lib/matching/http";

/** 10.4: the provider closes today's work day with photos. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  const photoPaths = Array.isArray(body?.photoPaths) ? body.photoPaths.filter((p): p is string => typeof p === "string") : [];
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : null;
  if (!UUID.test(id) || photoPaths.length < 1 || photoPaths.length > 10) {
    return Response.json({ error: "Add 1 to 10 photos of today's work." }, { status: 400 });
  }
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.session.rpc("close_work_day", { p_booking_id: id, p_photo_paths: photoPaths, p_note: note });
  if (error) return databaseError(error, "Could not close the day. Try again.");
  await deliverNotifications((data as { notify?: unknown } | null)?.notify);
  return Response.json({ ok: true });
}
