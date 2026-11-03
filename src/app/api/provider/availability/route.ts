import { databaseError, readBody, requireUser } from "@/lib/matching/http";

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return Response.json({ error: "Availability details are required." }, { status: 400 });
  const startsAt = typeof body?.startsAt === "string" ? new Date(body.startsAt) : null;
  const endsAt = typeof body?.endsAt === "string" ? new Date(body.endsAt) : null;
  const kind = body?.kind === "unavailable" ? "unavailable" : body?.kind === "available" ? "available" : null;
  if (!startsAt || !endsAt || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || !kind) {
    return Response.json({ error: "Choose valid start and end times." }, { status: 400 });
  }
  if (endsAt <= startsAt) return Response.json({ error: "End time must be after start time." }, { status: 400 });
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.session.rpc("save_provider_availability", {
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_kind: kind,
    p_note: typeof body.note === "string" ? body.note : null,
  });
  if (error) return databaseError(error, "Could not save availability. Check for an overlapping job or time.");
  return Response.json({ availability: data });
}
