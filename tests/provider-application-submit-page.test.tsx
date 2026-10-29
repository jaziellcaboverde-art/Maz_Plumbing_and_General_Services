import { afterEach, describe, expect, test, vi } from "vitest";

const { createClientMock, redirectMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/server", () => ({ connection: async () => {} }));

import { ProviderApplicationSubmitContent } from "@/app/provider-application/submit/page";

afterEach(() => {
  createClientMock.mockReset();
  redirectMock.mockReset();
});

describe("provider application submit page", () => {
  test("redirects signed-out users to login", async () => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });

    await expect(ProviderApplicationSubmitContent())
      .rejects.toThrow("redirect:/login?next=/provider-application/submit");
    expect(redirectMock).toHaveBeenCalledWith("/login?next=/provider-application/submit");
  });
});
