import { NextResponse, type NextRequest } from "next/server";
import { isValidCoordinate, isPhilippinesCountryCode } from "@/lib/location/coordinates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ReverseResult = { country_code?: string };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const { data: { user } } = await supabase.auth.getUser(bearerToken);
  if (!user) return NextResponse.json({ error: "Sign in before saving a location." }, { status: 401 });

  let body: { target?: unknown; recordId?: unknown; latitude?: unknown; longitude?: unknown; landmark?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Choose a map location first." }, { status: 400 }); }
  const target = body.target;
  const recordId = typeof body.recordId === "string" ? body.recordId : "";
  const point = { latitude: Number(body.latitude), longitude: Number(body.longitude) };
  if ((target !== "address" && target !== "provider") || !recordId || !isValidCoordinate(point)) {
    return NextResponse.json({ error: "Choose a valid map location." }, { status: 400 });
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Add GEOAPIFY_API_KEY to .env.local to validate locations." }, { status: 503 });
  const reverseUrl = new URL("https://api.geoapify.com/v1/geocode/reverse");
  reverseUrl.searchParams.set("lat", String(point.latitude));
  reverseUrl.searchParams.set("lon", String(point.longitude));
  reverseUrl.searchParams.set("format", "json");
  reverseUrl.searchParams.set("apiKey", apiKey);
  try {
    const countryResponse = await fetch(reverseUrl, {
      headers: { "User-Agent": "MAZPlumbingGeneralServices/0.1 (location validation)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!countryResponse.ok) return NextResponse.json({ error: "Could not verify the map location. Try again." }, { status: 502 });
    const payload = await countryResponse.json() as { results?: ReverseResult[] };
    if (!payload.results?.some((result) => isPhilippinesCountryCode(result.country_code))) {
      return NextResponse.json({ error: "Choose a map location in the Philippines." }, { status: 422 });
    }
  } catch {
    return NextResponse.json({ error: "Could not verify the map location. Check your connection and try again." }, { status: 502 });
  }

  const admin = createAdminClient();
  if (target === "address") {
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "customer" && profile?.role !== "admin") return NextResponse.json({ error: "Only a customer can save a service address." }, { status: 403 });
    const { data: address, error } = await admin.from("addresses").select("id").eq("id", recordId).eq("profile_id", user.id).maybeSingle();
    if (error || !address) return NextResponse.json({ error: "Address not found." }, { status: 404 });
  } else {
    // provider_profiles references profiles twice (profile_id and reviewed_by), so
    // embedding profiles without naming the foreign key is ambiguous in PostgREST.
    const [{ data: profile, error: profileError }, { data: provider, error: providerError }] = await Promise.all([
      admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      admin.from("provider_profiles").select("profile_id,status").eq("profile_id", user.id).maybeSingle(),
    ]);
    if (profileError || providerError || profile?.role !== "provider" || provider?.status !== "approved") {
      return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
    }
  }

  const { error } = await admin.rpc("save_location_point", {
    p_target: target,
    p_id: target === "address" ? recordId : user.id,
    p_longitude: point.longitude,
    p_latitude: point.latitude,
    p_landmark: typeof body.landmark === "string" ? body.landmark.slice(0, 300) : null,
  });
  if (error) return NextResponse.json({ error: "The location could not be saved. Try again." }, { status: 500 });
  return NextResponse.json({ saved: true, ...point });
}
