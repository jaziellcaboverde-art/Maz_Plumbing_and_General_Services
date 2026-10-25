import { describe, expect, test } from "vitest";
import { distanceMeters, isPhilippinesCountryCode, isValidCoordinate, toLongitudeLatitude, withinArrivalRadius } from "@/lib/location/coordinates";

describe("location coordinates", () => {
  test("validates coordinate ranges and rejects non-numeric values", () => {
    expect(isValidCoordinate({ latitude: 14.6, longitude: 121 })).toBe(true);
    expect(isValidCoordinate({ latitude: 91, longitude: 121 })).toBe(false);
    expect(isValidCoordinate({ latitude: Number.NaN, longitude: 121 })).toBe(false);
  });

  test("keeps longitude first when converting a pin for PostGIS", () => {
    expect(toLongitudeLatitude({ latitude: 14.6, longitude: 121 })).toEqual([121, 14.6]);
  });

  test("accepts only the Philippines country code", () => {
    expect(isPhilippinesCountryCode("ph")).toBe(true);
    expect(isPhilippinesCountryCode("PH")).toBe(true);
    expect(isPhilippinesCountryCode("us")).toBe(false);
  });
});

describe("arrival distance", () => {
  const origin = { latitude: 14.6, longitude: 121 };
  const pointAt = (meters: number) => ({ latitude: origin.latitude + meters / 111_195, longitude: origin.longitude });

  test("accepts 199 metres and rejects 201 metres at the 200 metre rule", () => {
    expect(withinArrivalRadius(distanceMeters(origin, pointAt(199)))).toBe(true);
    expect(withinArrivalRadius(distanceMeters(origin, pointAt(201)))).toBe(false);
  });
});

describe("location migration", () => {
  test("uses PostGIS for longitude-first distance sorting and enforces the arrival radius", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261019140000_location_and_arrival.sql"), "utf8");
    expect(sql).toContain("st_makepoint(p_longitude, p_latitude)");
    expect(sql).toContain("revoke update (base_location) on public.provider_profiles from authenticated");
    expect(sql).toMatch(/order by extensions\.st_distance\(pp\.base_location, v_origin\)/);
    expect(sql).toContain("v_distance <= v_radius");
    expect(sql).toContain("arrival_override.review");
  });
});
