import { deliverNotifications } from "@/lib/matching/engine";
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
  const notes =
    typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
  const photoPaths = Array.isArray(body?.photoPaths)
    ? body.photoPaths
        .filter((path): path is string => typeof path === "string")
        .slice(0, 10)
    : [];
  if (!UUID.test(id) || notes.length < 10 || photoPaths.length < 1) {
    return Response.json(
      { error: "Add completion notes and at least one photo." },
      { status: 400 },
    );
  }
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.session.rpc("submit_provider_completion", {
    p_booking_id: id,
    p_notes: notes,
    p_photo_paths: photoPaths,
  });
  if (error)
    return databaseError(
      error,
      "Could not submit completion. Check the job requirements and try again.",
    );
  await deliverNotifications((data as { notify?: unknown } | null)?.notify);
  return Response.json({ ok: true });
}
