import { NextRequest } from "next/server";
import { afterEach, describe, expect, test, vi } from "vitest";

const { createServerClientMock, verifyTurnstileMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  verifyTurnstileMock: vi.fn().mockResolvedValue(true),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));
vi.mock("@/lib/auth/turnstile", () => ({
  clientIp: vi.fn(),
  verifyTurnstile: verifyTurnstileMock,
}));

import { POST } from "@/app/api/auth/login/route";

function call(body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "person@example.com",
        password: "pass",
        ...body,
      }),
    }),
  );
}

function configureUser(user: Record<string, unknown>) {
  const signInWithPassword = vi
    .fn()
    .mockResolvedValue({ data: { user }, error: null });
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

    expect(await response.json()).toMatchObject({
      ok: true,
      redirectTo: "/customer",
    });
  });
});

describe("login service diagnostics", () => {
  test("missing Supabase settings are reported as setup_required, not a connection error", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await call({});
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        ok: false,
        reason: "setup_required",
      });
      expect(createServerClientMock).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  test("placeholder or malformed Supabase settings are reported as invalid_configuration", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "YOUR_SUPABASE_URL");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "YOUR_SUPABASE_ANON_KEY");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await call({});
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        ok: false,
        reason: "invalid_configuration",
      });
      expect(createServerClientMock).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  test("a Supabase network failure is reported separately from wrong credentials", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-public-key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    createServerClientMock.mockReturnValue({
      auth: {
        signInWithPassword: vi
          .fn()
          .mockRejectedValue(new TypeError("fetch failed")),
      },
    });
    try {
      const response = await call({});
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        ok: false,
        reason: "connection_failed",
      });
    } finally {
      log.mockRestore();
    }
  });

  test("wrong password still produces the non-revealing credentials error", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-public-key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    createServerClientMock.mockReturnValue({
      auth: {
        signInWithPassword: vi
          .fn()
          .mockResolvedValue({
            data: { user: null },
            error: {
              code: "invalid_credentials",
              message: "Invalid login credentials",
              status: 400,
            },
          }),
      },
    });
    const response = await call({});
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      ok: false,
      reason: "invalid_credentials",
    });
  });
});
