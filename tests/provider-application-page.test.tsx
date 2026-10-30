import { afterEach, describe, expect, test, vi } from "vitest";

const { createAdminClientMock, createClientMock, redirectMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createClientMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdminClientMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/server", () => ({ connection: async () => {} }));

import { ProviderApplicationStatusPage } from "@/app/provider-application/page";

afterEach(() => {
  createAdminClientMock.mockReset();
  createClientMock.mockReset();
  redirectMock.mockReset();
});

describe("provider application status page", () => {
  test("sends an applicant without an application to the designed application form", async () => {
    const user = { id: "provider-applicant", app_metadata: { role: "customer" } };
    createClientMock.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } });
    createAdminClientMock.mockReturnValue({
      from(table: string) {
        const data = table === "profiles" ? { role: "customer" } : null;
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data }),
        };
        return query;
      },
    });
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });

    await expect(ProviderApplicationStatusPage())
      .rejects.toThrow("redirect:/provider-application/submit");
    expect(redirectMock).toHaveBeenCalledWith("/provider-application/submit");
  });
});
