import { NextRequest } from "next/server";
import { afterEach, describe, expect, test, vi } from "vitest";

const { createAdminClientMock } = vi.hoisted(() => ({ createAdminClientMock: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdminClientMock }));

import { POST } from "@/app/api/auth/signup/route";

const valid = {
  kind: "customer",
  email: "person@example.com",
  password: "long-enough-1",
  firstName: "Ana",
  lastName: "Cruz",
  birthday: "1990-05-05",
  mobile: "+639171234567",
  accountType: "household",
};

function call(body: Record<string, unknown>) {
  return POST(new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@supabase/ssr");
  createAdminClientMock.mockReset();
});

describe("sign up route (steps 5.2, 5.4, 5.8)", () => {
  test("blocks someone under 18 with a clear message", async () => {
    const year = new Date().getUTCFullYear() - 10;
    const response = await call({ ...valid, birthday: `${year}-01-01` });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ reason: "under_18", message: "You must be at least 18 years old to create an account." });
  });

  test("blocks a provider applicant under 18", async () => {
    const year = new Date().getUTCFullYear() - 10;
    const body = await (await call({ ...valid, kind: "provider", birthday: `${year}-01-01` })).json();
    expect(body.message).toBe("Applicants must be at least 18 years old.");
  });

  test("accepts only +639XXXXXXXXX mobile numbers", async () => {
    const body = await (await call({ ...valid, mobile: "09171234567" })).json();
    expect(body.reason).toBe("invalid_request");
  });

  test("a business account needs a business name", async () => {
    const body = await (await call({ ...valid, accountType: "business", businessName: "" })).json();
    expect(body.message).toBe("Enter your business name.");
  });

  test("rejects a short password and an unknown kind", async () => {
    expect((await call({ ...valid, password: "short" })).status).toBe(400);
    expect((await call({ ...valid, kind: "admin" })).status).toBe(400);
  });

  test("needs the Cloudflare check when Turnstile is on", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const response = await call(valid);
    expect(await response.json()).toMatchObject({ ok: false, reason: "captcha_failed" });
  });
});

describe("an email that already has an account", () => {
  test("is blocked with a clear message instead of a fake success", async () => {
    vi.resetModules();
    vi.doMock("@supabase/ssr", () => ({
      createServerClient: () => ({ auth: { signUp: async () => ({ data: { user: { identities: [] }, session: null }, error: null }) } }),
    }));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const { POST: freshPost } = await import("@/app/api/auth/signup/route");
    const response = await freshPost(new NextRequest("http://localhost/api/auth/signup", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(valid),
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false, reason: "email_exists", message: expect.stringContaining("already has an account") });
    vi.doUnmock("@supabase/ssr");
  });
});

describe("provider signup", () => {
  test("keeps customer signup on the customer path without assigning a provider role", async () => {
    vi.resetModules();
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "customer-user", identities: [{ id: "identity" }] }, session: null },
      error: null,
    });
    vi.doMock("@supabase/ssr", () => ({
      createServerClient: () => ({ auth: { signUp } }),
    }));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");

    const { POST: freshPost } = await import("@/app/api/auth/signup/route");
    const response = await freshPost(new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(valid),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      redirectTo: "/customer/setup",
    });
    expect(signUp.mock.calls[0][0].options.data).not.toHaveProperty("signup_intent");
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  test("keeps the role out of user metadata and assigns it through the trusted server function", async () => {
    vi.resetModules();
    const session = { refresh_token: "refresh-token" };
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "provider-user", identities: [{ id: "identity" }] }, session },
      error: null,
    });
    const refreshSession = vi.fn().mockResolvedValue({ error: null });
    vi.doMock("@supabase/ssr", () => ({
      createServerClient: () => ({ auth: { signUp, refreshSession } }),
    }));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    createAdminClientMock.mockReturnValue({ rpc, auth: { admin: { deleteUser } } });

    const { POST: freshPost } = await import("@/app/api/auth/signup/route");
    const response = await freshPost(new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...valid, kind: "provider" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      signedIn: true,
      redirectTo: "/provider-application/submit",
    });
    const signupOptions = signUp.mock.calls[0][0].options;
    expect(signupOptions.emailRedirectTo).toContain("/auth/confirm?next=/provider-application/submit");
    expect(signupOptions.data).toMatchObject({ signup_intent: "provider" });
    expect(signupOptions.data).not.toHaveProperty("role");
    expect(rpc).toHaveBeenCalledWith("register_provider_applicant", { p_user_id: "provider-user" });
    expect(refreshSession).toHaveBeenCalledWith(session);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  test("removes a newly created provider account if trusted role registration fails", async () => {
    vi.resetModules();
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "incomplete-provider", identities: [{ id: "identity" }] }, session: null },
      error: null,
    });
    vi.doMock("@supabase/ssr", () => ({
      createServerClient: () => ({ auth: { signUp } }),
    }));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const rpc = vi.fn().mockResolvedValue({
      error: { code: "PGRST202", message: "Could not find the function public.register_provider_applicant in the schema cache" },
    });
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    createAdminClientMock.mockReturnValue({ rpc, auth: { admin: { deleteUser } } });

    const { POST: freshPost } = await import("@/app/api/auth/signup/route");
    const response = await freshPost(new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...valid, kind: "provider" }),
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      reason: "provider_setup_failed",
      message: expect.stringContaining("required database update has not been applied"),
    });
    expect(deleteUser).toHaveBeenCalledWith("incomplete-provider");
  });
});
