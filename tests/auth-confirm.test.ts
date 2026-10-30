import { NextRequest } from "next/server";
import { afterEach, describe, expect, test, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { GET } from "@/app/auth/confirm/route";

afterEach(() => {
  vi.restoreAllMocks();
  createClientMock.mockReset();
});

describe("email confirmation callback", () => {
  test("preserves provider signup context when a confirmation link is invalid", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      error: { message: "Auth code has expired" },
    });
    createClientMock.mockResolvedValue({ auth: { exchangeCodeForSession } });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(new NextRequest(
      "http://localhost/auth/confirm?code=expired-code&next=%2Fauth%2Fcontinue%3Fintent%3Dprovider",
    ));

    const location = response.headers.get("location");
    expect(location).not.toBeNull();
    const redirect = new URL(location!);
    expect(redirect.pathname).toBe("/link-expired");
    expect(redirect.searchParams.get("next")).toBe("/auth/continue?intent=provider");
  });

  test("exchanges a valid auth code and redirects to the requested internal page", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({ auth: { exchangeCodeForSession } });

    const response = await GET(new NextRequest(
      "http://localhost/auth/confirm?code=valid-code&next=%2Fprovider-application%2Fsubmit",
    ));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/provider-application/submit");
  });
});
