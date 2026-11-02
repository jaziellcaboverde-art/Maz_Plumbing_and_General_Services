import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { createServerClientMock } = vi.hoisted(() => ({ createServerClientMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createServerClientMock }));

import { POST as search } from "@/app/api/location/geocode/route";
import { POST as reverse } from "@/app/api/location/reverse/route";

function post(path: string, body: unknown) {
  return new NextRequest(`http://localhost:3000/api/location/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.123" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  vi.stubEnv("GEOAPIFY_API_KEY", "test-map-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  createServerClientMock.mockClear();
});

describe("guest location lookups in provider application", () => {
  test("address search succeeds without Supabase credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{
        country_code: "ph", lat: 14.57, lon: 121.06,
        formatted: "Kapitolyo, Pasig, Metro Manila, Philippines", city: "Pasig",
      }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await search(post("geocode", { text: "Kapitolyo, Pasig" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      results: [{ latitude: 14.57, longitude: 121.06, city: "Pasig" }],
    });
    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("current-position reverse lookup succeeds without Supabase credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{
        country_code: "ph", formatted: "Kapitolyo, Pasig, Metro Manila, Philippines", city: "Pasig",
      }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await reverse(post("reverse", { latitude: 14.57, longitude: 121.06 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ label: "Kapitolyo, Pasig, Metro Manila, Philippines" });
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  test("reports missing Geoapify configuration, not missing Supabase", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "");
    const response = await search(post("geocode", { text: "Kapitolyo, Pasig" }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toMatch(/GEOAPIFY_API_KEY/);
    expect(body.error).not.toMatch(/Supabase/);
    expect(createServerClientMock).not.toHaveBeenCalled();
  });
});
