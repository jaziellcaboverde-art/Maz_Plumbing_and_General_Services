import { databaseError, readBody, requireUser } from "@/lib/matching/http";

export async function POST(request: Request) {
  const body = await readBody(request);
  const hours = body?.hours;
  if (
    !Array.isArray(hours) ||
    hours.length > 7 ||
    hours.some(
      (h) =>
        !h ||
        typeof h !== "object" ||
        !Number.isInteger(h.weekday) ||
        h.weekday < 0 ||
        h.weekday > 6 ||
        typeof h.start !== "string" ||
        typeof h.end !== "string" ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.start) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.end) ||
        h.start >= h.end,
    ) ||
    new Set(hours.map((h) => h.weekday)).size !== hours.length
  )
    return Response.json(
      { error: "Choose unique days and valid working hours." },
      { status: 400 },
    );
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await auth.session.rpc("save_provider_weekly_hours", {
    p_hours: hours,
  });
  return error
    ? databaseError(error, "Could not save working hours.")
    : Response.json({ ok: true });
}
