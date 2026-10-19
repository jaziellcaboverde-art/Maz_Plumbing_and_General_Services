import { NextResponse, type NextRequest } from "next/server";
import { isValidCoordinate, isPhilippinesCountryCode } from "@/lib/location/coordinates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ReverseResult = { country_code?: string };

export async function POST(request: NextRequest) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to find nearby providers." }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "customer" && profile?.role !== "admin") {
    return NextResponse.json({ error: "Only customers and admins can search providers." }, { status: 403 });
  }

  let body: { latitude?: unknown; longitude?: unknown; radiusMeters?: unknown; serviceId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Choose a valid map point." }, { status: 400 }); }
  const point = { latitude: Number(body.latitude), longitude: Number(body.longitude) };
  const radiusMeters = Number(body.radiusMeters);
  const serviceId = typeof body.serviceId === "string" ? body.serviceId : null;
  if (!isValidCoordinate(point) || !Number.isFinite(radiusMeters) || radiusMeters < 100 || radiusMeters > 50000) {
    return NextResponse.json({ error: "Choose a valid point and search radius (100 m to 50 km)." }, { status: 400 });
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Address validation is unavailable until GEOAPIFY_API_KEY is configured." }, { status: 503 });
  const reverseUrl = new URL("https://api.geoapify.com/v1/geocode/reverse");
  reverseUrl.searchParams.set("lat", String(point.latitude));
  reverseUrl.searchParams.set("lon", String(point.longitude));
  reverseUrl.searchParams.set("format", "json");
  reverseUrl.searchParams.set("apiKey", apiKey);
  try {
    const response = await fetch(reverseUrl, {
      headers: { "User-Agent": "MAZPlumbingGeneralServices/0.1 (provider search)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Could not verify this location. Try again." }, { status: 502 });
    const payload = await response.json() as { results?: ReverseResult[] };
    if (!payload.results?.some((result) => isPhilippinesCountryCode(result.country_code))) {
      return NextResponse.json({ error: "Choose a point in the Philippines." }, { status: 422 });
    }
  } catch {
    return NextResponse.json({ error: "Location validation failed. Check your connection and try again." }, { status: 502 });
  }

  const { data, error } = await admin.rpc("find_nearby_approved_providers", {
    p_longitude: point.longitude,
    p_latitude: point.latitude,
    p_radius_m: radiusMeters,
    p_service_id: serviceId,
  });
  if (error) return NextResponse.json({ error: "Nearby providers could not be loaded." }, { status: 500 });
  return NextResponse.json({ providers: data ?? [] });
}
