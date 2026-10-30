import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientIp } from "@/lib/auth/turnstile";
import { allowGuestLookup } from "@/lib/location/guest-limit";
import { isPhilippinesCountryCode } from "@/lib/location/coordinates";
import { addressPartsFrom, type GeoapifyAddress } from "@/lib/location/address-parts";

type GeoapifyResult = GeoapifyAddress & {
  lat?: number;
  lon?: number;
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country_code?: string;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const bearerToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const { data: { user } } = await supabase.auth.getUser(bearerToken);
  // Visitors without an account may look up addresses while applying as a provider, within a small allowance.
  if (!user && !allowGuestLookup(clientIp(request.headers))) {
    return NextResponse.json({ error: "Too many lookups. Wait a minute and try again." }, { status: 429 });
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Add GEOAPIFY_API_KEY to .env.local to enable address search." }, { status: 503 });

  let body: { text?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Enter an address to search." }, { status: 400 }); }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 200) : "";
  if (text.length < 3) return NextResponse.json({ error: "Enter at least 3 characters." }, { status: 400 });

  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", text);
  url.searchParams.set("filter", "countrycode:ph");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("apiKey", apiKey);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "MAZPlumbingGeneralServices/0.1 (address lookup)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Address search is temporarily unavailable. Try again or enter a landmark." }, { status: 502 });
    const payload = await response.json() as { results?: GeoapifyResult[] };
    const results = (payload.results ?? []).filter((item) => isPhilippinesCountryCode(item.country_code)
      && Number.isFinite(item.lat) && Number.isFinite(item.lon))
      .map((item) => ({
        latitude: item.lat as number,
        longitude: item.lon as number,
        label: item.formatted ?? [item.address_line1, item.address_line2].filter(Boolean).join(", "),
        city: item.city ?? item.county ?? "",
        province: item.state ?? "",
        postcode: item.postcode ?? "",
        parts: addressPartsFrom(item),
      }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Address search failed. Check your connection or enter a landmark." }, { status: 502 });
  }
}
