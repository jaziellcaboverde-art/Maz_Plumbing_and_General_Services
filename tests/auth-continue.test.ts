import { NextRequest } from "next/server";
import { afterEach, describe, expect, test, vi } from "vitest";

const { createClientMock, createAdminClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdminClientMock }));

import { GET } from "@/app/auth/continue/route";

function createSupabase(user: Record<string, unknown>, profile: Record<string, unknown> | null = null) {
  const updateUser = vi.fn().mockResolvedValue({ error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
      updateUser,
      refreshSession: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnValue({ select }),
  };
  return { supabase, updateUser };
}

function request(path = "/auth/continue") {
  return new NextRequest(`http://localhost${path}`);
}

function redirectedPath(response: Response) {
  const location = response.headers.get("location");
  if (!location) throw new Error("Expected an auth continuation redirect.");
  return new URL(location).pathname;
}

afterEach(() => {
  vi.restoreAllMocks();
  createClientMock.mockReset();
  createAdminClientMock.mockReset();
});

describe("auth continuation", () => {
  test("routes a provider email signup by its stored intent without trusting user metadata for role", async () => {
    const { supabase, updateUser } = createSupabase({
      id: "provider-applicant",
      app_metadata: { role: "customer" },
      user_metadata: { signup_intent: "provider", role: "provider" },
    });
    createClientMock.mockResolvedValue(supabase);
    const rpc = vi.fn().mockResolvedValue({ error: null });
    createAdminClientMock.mockReturnValue({ rpc });

    const response = await GET(request());

    expect(redirectedPath(response)).toBe("/provider-application/submit");
    expect(updateUser).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("register_provider_applicant", { p_user_id: "provider-applicant" });
    expect(supabase.auth.refreshSession).toHaveBeenCalledOnce();
  });

  test("persists Google provider intent and routes to provider onboarding", async () => {
    const { supabase, updateUser } = createSupabase({
      id: "google-applicant",
      app_metadata: { role: "customer" },
      user_metadata: { given_name: "Ana", family_name: "Cruz" },
    });
    createClientMock.mockResolvedValue(supabase);
    const rpc = vi.fn().mockResolvedValue({ error: null });
    createAdminClientMock.mockReturnValue({ rpc });

    const response = await GET(request("/auth/continue?intent=provider"));

    expect(redirectedPath(response)).toBe("/provider-application/submit");
    expect(updateUser).toHaveBeenCalledWith({
      data: { given_name: "Ana", family_name: "Cruz", signup_intent: "provider" },
    });
    expect(rpc).toHaveBeenCalledWith("register_provider_applicant", { p_user_id: "google-applicant" });
    expect(supabase.auth.refreshSession).toHaveBeenCalledOnce();
  });

  test("reports a failed Google intent update instead of pretending it was preserved", async () => {
    const { supabase, updateUser } = createSupabase({
      id: "google-applicant",
      app_metadata: { role: "customer" },
      user_metadata: { given_name: "Ana" },
    });
    updateUser.mockResolvedValue({ error: { message: "Auth service unavailable" } });
    createClientMock.mockResolvedValue(supabase);
    const rpc = vi.fn();
    createAdminClientMock.mockReturnValue({ rpc });
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(request("/auth/continue?intent=provider"));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "Could not preserve your provider application choice. Please try signing in again.",
    });
    expect(logError).toHaveBeenCalledWith("Could not preserve provider signup intent:", "Auth service unavailable");
    expect(rpc).not.toHaveBeenCalled();
    logError.mockRestore();
  });

  test("reports when the provider role migration is missing", async () => {
    const { supabase } = createSupabase({
      id: "google-applicant",
      app_metadata: { role: "customer" },
      user_metadata: { signup_intent: "provider" },
    });
    createClientMock.mockResolvedValue(supabase);
    createAdminClientMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        error: { code: "PGRST202", message: "Could not find the function public.register_provider_applicant" },
      }),
    });

    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("required database update has not been applied"),
    });
  });

  test("keeps incomplete customer signups on customer setup", async () => {
    const { supabase, updateUser } = createSupabase({
      id: "customer",
      app_metadata: { role: "customer" },
      user_metadata: { signup_intent: "customer" },
    });
    createClientMock.mockResolvedValue(supabase);

    const response = await GET(request());

    expect(redirectedPath(response)).toBe("/customer/setup");
    expect(updateUser).not.toHaveBeenCalled();
  });

  test("sends a customer with a complete profile to the customer home", async () => {
    const { supabase } = createSupabase(
      { id: "complete-customer", app_metadata: { role: "customer" }, user_metadata: {} },
      { first_name: "Ana", last_name: "Cruz", birthday: "1990-05-05", mobile: "+639171234567" },
    );
    createClientMock.mockResolvedValue(supabase);

    const response = await GET(request());

    expect(redirectedPath(response)).toBe("/customer");
  });

  test("does not let provider intent override an approved provider role", async () => {
    const { supabase, updateUser } = createSupabase({
      id: "approved-provider",
      app_metadata: { role: "provider" },
      user_metadata: {},
    }, { status: "approved" });
    createClientMock.mockResolvedValue(supabase);

    const response = await GET(request("/auth/continue?intent=provider"));

    expect(redirectedPath(response)).toBe("/provider");
    expect(updateUser).not.toHaveBeenCalled();
  });
});
