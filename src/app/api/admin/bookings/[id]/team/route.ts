import { deliverNotifications } from "@/lib/matching/engine";
import {
  databaseError,
  readBody,
  requireAdmin,
  UUID,
} from "@/lib/matching/http";
import { directTeamSchema } from "@/lib/provider/team";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = directTeamSchema.safeParse(await readBody(request));
  if (!UUID.test(id) || !parsed.success)
    return Response.json(
      {
        error: parsed.success
          ? "Choose a valid booking."
          : parsed.error.issues[0]?.message,
      },
      { status: 400 },
    );
  const d = parsed.data;
  const { data, error } = await auth.session.rpc("assign_provider_team", {
    p_booking: id,
    p_workers: d.workers,
    p_phase: d.phase,
    p_key: d.key,
  });
  if (error?.code === "PGRST202")
    return Response.json(
      {
        error:
          "Direct team assignments require the latest database migration (20261105020000). Apply it before assigning or confirming workers.",
      },
      { status: 503 },
    );
  if (error)
    return databaseError(
      error,
      "Could not assign the team. No new assignments were saved.",
    );
  if (!data?.replayed) await deliverNotifications(data?.notify);
  return Response.json({ ok: true, assignments: data?.assignments });
}
