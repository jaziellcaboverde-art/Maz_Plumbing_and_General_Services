import { afterEach, describe, expect, test, vi } from "vitest";

const { createClientMock, notFoundMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  notFoundMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));
vi.mock("next/server", () => ({ connection: async () => {} }));

import { PublicPlaceholderContent } from "@/app/(public)/[slug]/page";

afterEach(() => {
  createClientMock.mockReset();
  notFoundMock.mockReset();
});

describe("public placeholder page", () => {
  test("renders the latest published terms version", async () => {
    const query = {
      select: () => query,
      eq: () => query,
      not: () => query,
      order: () => query,
      limit: () => query,
      maybeSingle: vi.fn().mockResolvedValue({
        data: { version: "2026.1", body: "1. Use the service\nA clear rule." },
      }),
    };
    createClientMock.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });

    const result = await PublicPlaceholderContent({
      params: Promise.resolve({ slug: "terms" }),
    });

    expect(result).toMatchObject({
      type: "article",
      props: { className: expect.any(String) },
    });
    expect(createClientMock).toHaveBeenCalledOnce();
  });

  test("does not query Supabase for placeholder-only slugs", async () => {
    const result = await PublicPlaceholderContent({
      params: Promise.resolve({ slug: "cancellation" }),
    });

    expect(result).toMatchObject({
      props: { title: "Cancellation", phase: 16 },
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
