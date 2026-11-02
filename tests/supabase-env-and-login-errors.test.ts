import { afterEach, describe, expect, test, vi } from "vitest";
import { classifyLoginFailure } from "@/lib/auth/login-failure";
import { getSupabaseEnvStatus, getSupabasePublicEnv } from "@/lib/supabase/env";

afterEach(() => vi.unstubAllEnvs());

describe("Supabase environment validation", () => {
  test("missing credentials", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(getSupabaseEnvStatus()).toBe("setup_required");
    expect(getSupabasePublicEnv()).toBeNull();
  });
  test("invalid URL or placeholder credentials", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://my-project.supabase.co/auth/v1",
    );
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "abc");
    expect(getSupabaseEnvStatus()).toBe("invalid_configuration");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "YOUR_ANON_KEY");
    expect(getSupabaseEnvStatus()).toBe("invalid_configuration");
  });
  test("valid public URL and key are accepted", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_test");
    expect(getSupabaseEnvStatus()).toBe("ready");
    expect(getSupabasePublicEnv()).toEqual({
      url: "https://my-project.supabase.co",
      anonKey: "sb_publishable_test",
    });
  });
});

describe("login error classification", () => {
  test("recognizes network failures", () => {
    expect(classifyLoginFailure(new TypeError("fetch failed"))).toBe(
      "connection_failed",
    );
    expect(
      classifyLoginFailure({
        name: "AuthRetryableFetchError",
        message: "HTTP problem",
      }),
    ).toBe("connection_failed");
  });
  test("recognizes invalid API keys and service errors", () => {
    expect(
      classifyLoginFailure({ message: "Invalid API key", status: 401 }),
    ).toBe("invalid_configuration");
    expect(classifyLoginFailure({ message: "server down", status: 503 })).toBe(
      "service_unavailable",
    );
  });
  test("preserves authentication privacy and email confirmation", () => {
    expect(
      classifyLoginFailure({
        code: "email_not_confirmed",
        message: "email not confirmed",
      }),
    ).toBe("email_not_confirmed");
    expect(
      classifyLoginFailure({
        code: "invalid_credentials",
        message: "Invalid login credentials",
        status: 400,
      }),
    ).toBe("invalid_credentials");
  });
});
