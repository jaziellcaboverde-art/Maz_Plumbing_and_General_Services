import { NextRequest } from "next/server";
import { afterEach, describe, expect, test, vi } from "vitest";

const { createServerClientMock, verifyTurnstileMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  verifyTurnstileMock: vi.fn().mockResolvedValue(true),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: createServerClientMock }));
vi.mock("@/lib/auth/turnstile", () => ({
  clientIp: vi.fn(),
  verifyTurnstile: verifyTurnstileMock,
}));

import { POST } from "@/app/api/auth/login/route";

function call(body: Record<string, unknown>) {
  return POST(new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "person@example.com", password: "pass", ...body }),
  }));
}

function configureUser(user: Record<string, unknown>) {
  const signInWithPassword = vi.fn().mockResolvedValue({ data: { user }, error: null });
  createServerClientMock.mockReturnValue({ auth: { signInWithPassword } });
  return signInWithPassword;
}

afterEach(() => {
  vi.unstubAllEnvs();
  createServerClientMock.mockReset();
  verifyTurnstileMock.mockClear();
});

describe("login redirect", () => {
  test("returns provider applicants to provider onboarding without granting a provider role", async () => {
    configureUser({
      app_metadata: { role: "customer" },
      user_metadata: { signup_intent: "provider", role: "provider" },
    });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");

    const response = await call({ next: "/customer/setup" });

    expect(await response.json()).toMatchObject({
      ok: true,
      redirectTo: "/provider-application/submit",
    });
  });

  test("keeps ordinary customer login routing unchanged", async () => {
    configureUser({
      app_metadata: { role: "customer" },
      user_metadata: { signup_intent: "customer" },
    });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");

    const response = await call({});

    expect(await response.json()).toMatchObject({ ok: true, redirectTo: "/customer" });
  });
});
