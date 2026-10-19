import { NextResponse, type NextRequest } from "next/server";
import { isPhilippinesCountryCode, isValidCoordinate } from "@/lib/location/coordinates";
import { createClient } from "@/lib/supabase/server";

type ReverseResult = {
  formatted?: string;
  country_code?: string;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const bearerToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const { data: { user } } = await supabase.auth.getUser(bearerToken);
  if (!user) return NextResponse.json({ error: "Sign in to look up this location." }, { status: 401 });

  let body: { latitude?: unknown; longitude?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Location coordinates are missing." }, { status: 400 }); }
  const point = { latitude: Number(body.latitude), longitude: Number(body.longitude) };
  if (!isValidCoordinate(point)) return NextResponse.json({ error: "Choose a valid map point." }, { status: 400 });

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Add GEOAPIFY_API_KEY to .env.local to look up pin addresses." }, { status: 503 });

  const url = new URL("https://api.geoapify.com/v1/geocode/reverse");
  url.searchParams.set("lat", String(point.latitude));
  url.searchParams.set("lon", String(point.longitude));
  url.searchParams.set("format", "json");
  url.searchParams.set("apiKey", apiKey);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "MAZPlumbingGeneralServices/0.1 (pin address lookup)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Could not look up the address at this pin." }, { status: 502 });
    const payload = await response.json() as { results?: ReverseResult[] };
    const result = payload.results?.find((item) => isPhilippinesCountryCode(item.country_code) && item.formatted?.trim());
    if (!result?.formatted) return NextResponse.json({ error: "No Philippine address was found at this pin. You can still add a landmark." }, { status: 404 });
    return NextResponse.json({ label: result.formatted });
  } catch {
    return NextResponse.json({ error: "Address lookup failed. Check your connection or enter a landmark." }, { status: 502 });
  }
}
