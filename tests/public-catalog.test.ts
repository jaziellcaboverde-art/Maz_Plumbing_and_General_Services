import { beforeEach, expect, test, vi } from "vitest";
import { loadPublicServices } from "@/lib/public/load-services";

const mocks = vi.hoisted(() => ({ env: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/supabase/env", () => ({ getSupabasePublicEnv: mocks.env }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.create }));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

function database(data: unknown[], error: unknown = null) {
  mocks.env.mockReturnValue({
    url: "https://example.supabase.co",
    anonKey: "test",
  });
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValueOnce(query).mockResolvedValueOnce({ data, error });
  mocks.create.mockReturnValue({
    from: vi.fn().mockReturnValue(query),
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.supabase.co/${path}` },
        }),
      }),
    },
  });
  return query;
}

test("an empty active catalog does not resurrect the launch services", async () => {
  const query = database([]);
  expect(await loadPublicServices()).toEqual([]);
  expect(query.eq).toHaveBeenCalledWith("active", true);
});

test("admin cover, description and price are returned unchanged to shared cards", async () => {
  database([
    {
      id: "service-id",
      category: "Aircon",
      name: "Aircon cleaning",
      description: "",
      starting_price_php: "1200",
      price_note: "After inspection",
      image_path: "catalog/aircon.webp",
    },
  ]);
  expect(await loadPublicServices()).toEqual([
    {
      id: "service-id",
      category: "Aircon",
      name: "Aircon cleaning",
      description: "",
      startingPricePhp: 1200,
      priceNote: "After inspection",
      imageUrl: "https://example.supabase.co/catalog/aircon.webp",
    },
  ]);
});

test("a database failure cannot publish a replacement catalog", async () => {
  database([], { message: "unavailable" });
  await expect(loadPublicServices()).rejects.toThrow(
    "Could not load the service catalog",
  );
});
