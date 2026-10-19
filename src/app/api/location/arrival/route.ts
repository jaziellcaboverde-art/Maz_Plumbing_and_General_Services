import { NextResponse, type NextRequest } from "next/server";
import { isValidCoordinate } from "@/lib/location/coordinates";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to check in." }, { status: 401 });
  let body: { bookingId?: unknown; latitude?: unknown; longitude?: unknown; accuracyMeters?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Location data is missing." }, { status: 400 }); }
  const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
  const point = { latitude: Number(body.latitude), longitude: Number(body.longitude) };
  const accuracyMeters = Number(body.accuracyMeters);
  if (!bookingId || !isValidCoordinate(point) || !Number.isFinite(accuracyMeters) || accuracyMeters < 0 || accuracyMeters > 100000) {
    return NextResponse.json({ error: "GPS returned invalid coordinates or accuracy." }, { status: 400 });
  }
  const { data, error } = await supabase.rpc("record_provider_arrival", {
    p_booking_id: bookingId,
    p_longitude: point.longitude,
    p_latitude: point.latitude,
    p_accuracy_m: accuracyMeters,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json(data?.[0] ?? { error: "Arrival could not be recorded." }, { status: data?.length ? 200 : 500 });
}
