import { deliverNotifications } from "@/lib/matching/engine";
import { databaseError, readBody, requireUser, UUID } from "@/lib/matching/http";
import { isValidCoordinate } from "@/lib/location/coordinates";

/** Step 9.2: the provider records the site inspection with GPS, notes and photo paths. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  if (!UUID.test(id) || !body) return Response.json({ error: "The inspection details are missing." }, { status: 400 });
  const point = { latitude: Number(body.latitude), longitude: Number(body.longitude) };
  const accuracy = Number(body.accuracyMeters);
  if (!isValidCoordinate(point) || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000) {
    return Response.json({ error: "GPS returned invalid coordinates or accuracy." }, { status: 400 });
  }
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
  if (notes.length < 10) return Response.json({ error: "Write what you found, at least 10 characters." }, { status: 400 });
  const photos = Array.isArray(body.photoPaths) ? body.photoPaths.filter((p): p is string => typeof p === "string").slice(0, 10) : [];
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.session.rpc("record_site_inspection", {
    p_booking_id: id, p_longitude: point.longitude, p_latitude: point.latitude,
    p_accuracy_m: accuracy, p_notes: notes, p_photo_paths: photos,
  });
  if (error) return databaseError(error, "Could not save the inspection. Try again.");
  const result = data as { recorded?: boolean; distance_m?: number; allowed_radius_m?: number; notify?: unknown } | null;
  await deliverNotifications(result?.notify);
  return Response.json({ ok: true, recorded: !!result?.recorded, distanceM: result?.distance_m ?? null, allowedRadiusM: result?.allowed_radius_m ?? null });
}
