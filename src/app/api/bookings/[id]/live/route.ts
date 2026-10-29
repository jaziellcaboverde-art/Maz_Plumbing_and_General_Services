import { databaseError, readBody, requireUser, UUID } from "@/lib/matching/http";
import { isValidCoordinate } from "@/lib/location/coordinates";

/** 10.2a, provider side: the phone sends where it is while the booking is on the way. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  const point = { latitude: Number(body?.latitude), longitude: Number(body?.longitude) };
  const accuracy = body?.accuracyMeters == null ? null : Number(body.accuracyMeters);
  if (!UUID.test(id) || !isValidCoordinate(point) || (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0))) {
    return Response.json({ error: "GPS returned invalid coordinates." }, { status: 400 });
  }
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await auth.session.rpc("update_live_location", {
    p_booking_id: id, p_latitude: point.latitude, p_longitude: point.longitude, p_accuracy_m: accuracy,
  });
  if (error) return databaseError(error, "Could not share your location.");
  return Response.json({ ok: true });
}

/** 10.2a, customer side: where the provider is now. Row level security only shows the booking's customer. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ location: null }, { status: 404 });
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data } = await auth.session.from("live_locations").select("latitude,longitude,updated_at").eq("booking_id", id).maybeSingle();
  return Response.json({ location: data ? { latitude: data.latitude, longitude: data.longitude, updatedAt: data.updated_at } : null },
    { headers: { "Cache-Control": "no-store" } });
}
