import {
  databaseError,
  readBody,
  requireUser,
  UUID,
} from "@/lib/matching/http";
import { notifyProviderSubmission } from "@/lib/provider/notify";

const KINDS = [
  "inspection",
  "progress",
  "milestone",
  "change_request",
  "issue",
  "completion",
];
export async function POST(request: Request) {
  const body = await readBody(request);
  if (
    !body ||
    typeof body.bookingId !== "string" ||
    !UUID.test(body.bookingId) ||
    typeof body.key !== "string" ||
    !UUID.test(body.key) ||
    typeof body.kind !== "string" ||
    !KINDS.includes(body.kind) ||
    typeof body.notes !== "string" ||
    body.notes.trim().length < 10 ||
    body.notes.length > 4000 ||
    !Array.isArray(body.photoPaths) ||
    body.photoPaths.length > 10 ||
    body.photoPaths.some((p) => typeof p !== "string" || p.length > 300) ||
    (body.milestoneId != null &&
      (typeof body.milestoneId !== "string" || !UUID.test(body.milestoneId)))
  ) {
    return Response.json(
      { error: "Check the update type, notes and evidence." },
      { status: 400 },
    );
  }
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (
    ["milestone", "completion"].includes(body.kind) &&
    body.photoPaths.length === 0
  )
    return Response.json(
      { error: "Add photographic evidence for this submission." },
      { status: 400 },
    );
  if (body.kind === "milestone" && !body.milestoneId)
    return Response.json(
      { error: "Choose the project milestone." },
      { status: 400 },
    );
  const { data, error } = await auth.session.rpc(
    "submit_provider_work_update",
    {
      p_booking: body.bookingId,
      p_kind: body.kind,
      p_notes: body.notes.trim(),
      p_photos: body.photoPaths,
      p_milestone: body.milestoneId ?? null,
      p_key: body.key,
    },
  );
  if (error)
    return databaseError(
      error,
      "Could not save your update. Please try again.",
    );
  await notifyProviderSubmission(
    body.bookingId,
    "Provider work submitted for review",
  ).catch((error) => console.error("work update notification", error));
  return Response.json({ ok: true, id: data });
}
