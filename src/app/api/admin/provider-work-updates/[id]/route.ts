import {
  databaseError,
  readBody,
  requireUser,
  UUID,
} from "@/lib/matching/http";
import { deliverNotifications } from "@/lib/matching/engine";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await readBody(request);
  if (!UUID.test(id) || typeof body?.approve !== "boolean")
    return Response.json(
      { error: "Choose an approval decision." },
      { status: 400 },
    );
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await auth.session.rpc("review_provider_work_update", {
    p_update: id,
    p_approve: body.approve,
    p_note: typeof body.note === "string" ? body.note.slice(0, 2000) : null,
  });
  if (error) return databaseError(error, "Could not review the submission.");
  const { data: update } = await auth.session
    .from("provider_work_updates")
    .select("provider_id,booking_id")
    .eq("id", id)
    .maybeSingle();
  if (update)
    await deliverNotifications([
      {
        profile_id: update.provider_id,
        event: "provider.work_reviewed",
        title: body.approve
          ? "MAZ reviewed your submission"
          : "MAZ requested corrections",
        body:
          typeof body.note === "string"
            ? body.note.slice(0, 500)
            : "Open your assignment to see the decision.",
        link: `/provider/jobs/${update.booking_id}`,
        channels: ["in_app"],
      },
    ]);
  return Response.json({ ok: true });
}
