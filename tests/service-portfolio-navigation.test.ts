import { beforeEach, expect, test, vi } from "vitest";
import { LAUNCH_SERVICES } from "@/lib/public/launch-services";
import { localPortfolio } from "@/lib/public/local-portfolio";
import { servicePath } from "@/lib/public/service-path";
import { loadServiceDetails } from "@/lib/public/service-details";

const mock = vi.hoisted(() => ({ env: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/supabase/env", () => ({ getSupabasePublicEnv: mock.env }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mock.create }));

beforeEach(() => vi.clearAllMocks());

test("every launch card opens a portfolio without configured Supabase", async () => {
  mock.env.mockReturnValue(null);
  for (const service of LAUNCH_SERVICES) {
    const path = servicePath(service);
    const result = await loadServiceDetails(path.split("/").at(-1)!);
    expect(result.service?.name).toBe(service.name);
    expect(result.reviews).toEqual([]);
    expect(result.photos).toEqual(localPortfolio(service.name));
  }
  expect(mock.create).not.toHaveBeenCalled();
});

test("a launch slug resolves the active service ID for photos and reviews", async () => {
  mock.env.mockReturnValue({
    url: "https://example.supabase.co",
    anonKey: "test",
  });
  const id = "12345678-1234-1234-1234-123456789abc";
  const service = {
    id,
    name: LAUNCH_SERVICES[0].name,
    category: "Plumbing",
    description: "Leak repair",
    starting_price_php: null,
    price_note: null,
  };
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: service, error: null });
  const portfolio = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  portfolio.select.mockReturnValue(portfolio);
  portfolio.eq.mockReturnValue(portfolio);
  portfolio.order.mockReturnValue(portfolio);
  portfolio.limit.mockResolvedValue({ data: [] });
  const review = {
    stars: 5,
    comment: "Leak fixed quickly",
    created_at: "2026-10-01",
  };
  const rpc = vi
    .fn()
    .mockImplementation((name: string) =>
      Promise.resolve({
        data: name === "public_service_reviews" ? [review] : [],
      }),
    );
  mock.create.mockReturnValue({
    from: (table: string) => (table === "services" ? query : portfolio),
    rpc,
  });
  const result = await loadServiceDetails(
    servicePath(LAUNCH_SERVICES[0]).split("/").at(-1)!,
  );
  expect(query.eq).toHaveBeenCalledWith("name", service.name);
  expect(query.eq).toHaveBeenCalledWith("active", true);
  expect(portfolio.eq).toHaveBeenCalledWith("service_id", id);
  expect(rpc).toHaveBeenCalledWith("public_service_reviews", {
    p_service_id: id,
  });
  expect(rpc).toHaveBeenCalledWith("public_project_portfolio", {
    p_service: id,
  });
  expect(result.reviews).toEqual([review]);
  expect(servicePath({ ...LAUNCH_SERVICES[0], id }, true)).toBe(
    `/customer/services/${id}`,
  );
});

test("unknown service paths do not query the database", async () => {
  expect((await loadServiceDetails("unknown-service")).service).toBeNull();
  expect(mock.create).not.toHaveBeenCalled();
});

test("live portfolios use admin photos and consent-filtered projects, without bundled demo photos", async () => {
  mock.env.mockReturnValue({
    url: "https://example.supabase.co",
    anonKey: "test",
  });
  const service = {
    id: "12345678-1234-1234-1234-123456789abc",
    name: LAUNCH_SERVICES[0].name,
    category: "Plumbing",
    description: "Current description",
    starting_price_php: 500,
    price_note: null,
    image_path: "catalog/cover.webp",
  };
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: service, error: null });
  const portfolio = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  portfolio.select.mockReturnValue(portfolio);
  portfolio.eq.mockReturnValue(portfolio);
  portfolio.order.mockReturnValue(portfolio);
  portfolio.limit.mockResolvedValue({
    data: [
      {
        id: "admin-photo",
        image_path: "service/current.webp",
        caption: "Admin caption",
        sort_order: 0,
      },
    ],
  });
  mock.create.mockReturnValue({
    from: (table: string) => (table === "services" ? query : portfolio),
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.supabase.co/${bucket}/${path}` },
        }),
      }),
    },
    rpc: vi
      .fn()
      .mockImplementation((name: string) =>
        Promise.resolve({
          data:
            name === "public_project_portfolio"
              ? [
                  {
                    id: "approved-project",
                    title: "Approved work",
                    photo_count: 1,
                  },
                ]
              : [],
        }),
      ),
  });
  const details = await loadServiceDetails(service.id);
  expect(details.service?.imageUrl).toBe(
    "https://example.supabase.co/service-photos/catalog/cover.webp",
  );
  expect(details.photos).toEqual([
    {
      id: "admin-photo",
      imageUrl:
        "https://example.supabase.co/service-portfolio/service/current.webp",
      caption: "Admin caption",
      sort_order: 0,
    },
    {
      id: "approved-project-0",
      imageUrl: "/api/portfolio/approved-project/0",
      caption: "Approved work",
      sort_order: 0,
    },
  ]);
});

test("bundled portfolio photos exist and match the service", async () => {
  const { existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  for (const service of LAUNCH_SERVICES) {
    for (const photo of localPortfolio(service.name)) {
      expect(existsSync(join(process.cwd(), "public", photo.imageUrl))).toBe(
        true,
      );
    }
  }
  expect(localPortfolio("Drain & Sewer Cleaning")).toHaveLength(5);
  expect(localPortfolio("Painting")).toEqual([]);
  expect(localPortfolio("Emergency Service")).toEqual([]);
  expect(
    localPortfolio("House & Condominium Renovation").length,
  ).toBeGreaterThan(10);
});
