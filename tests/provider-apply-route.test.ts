import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { signUp, deleteUser, submit } = vi.hoisted(() => ({
  signUp: vi.fn(),
  deleteUser: vi.fn(),
  submit: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { signUp } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ auth: { admin: { deleteUser } } }) }));
vi.mock("@/lib/provider/submit-application", () => ({ submitProviderApplication: submit }));

import { POST } from "@/app/api/provider-applications/apply/route";

const valid: Record<string, string> = {
  email: "applicant@example.com",
  password: "long-enough-1",
  account_first_name: "Juan",
  account_last_name: "Cruz",
  account_birthday: "1990-05-05",
  account_mobile: "+639171234567",
};

function call(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return POST(new NextRequest("http://localhost/api/provider-applications/apply", { method: "POST", body: form }));
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
  signUp.mockResolvedValue({ data: { user: { id: "11111111-2222-3333-4444-555555555555", identities: [{}] }, session: null }, error: null });
  deleteUser.mockResolvedValue({ error: null });
  submit.mockResolvedValue(Response.json({ ok: true, reference: "MAZ-11111111" }, { status: 201 }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  signUp.mockReset(); deleteUser.mockReset(); submit.mockReset();
});

describe("one-page provider apply route", () => {
  test("blocks an applicant under 18", async () => {
    const year = new Date().getUTCFullYear() - 10;
    const response = await call({ ...valid, account_birthday: `${year}-01-01` });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ reason: "under_18", message: "Applicants must be at least 18 years old." });
    expect(signUp).not.toHaveBeenCalled();
  });

  test("checks the mobile number, password and name before creating anything", async () => {
    expect((await call({ ...valid, account_mobile: "09171234567" })).status).toBe(400);
    expect((await call({ ...valid, password: "short" })).status).toBe(400);
    expect((await call({ ...valid, account_first_name: "" })).status).toBe(400);
    expect(signUp).not.toHaveBeenCalled();
  });

  test("needs the Cloudflare check when Turnstile is on", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const response = await call(valid);
    expect(await response.json()).toMatchObject({ ok: false, reason: "captcha_failed" });
    expect(signUp).not.toHaveBeenCalled();
  });

  test("an email that already has an account is refused", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "x", identities: [] }, session: null }, error: null });
    const response = await call(valid);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ reason: "email_exists" });
    expect(submit).not.toHaveBeenCalled();
  });

  test("creates the account, saves the application and returns the reference", async () => {
    const response = await call(valid);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true, reference: "MAZ-11111111", email: "applicant@example.com" });
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ userId: "11111111-2222-3333-4444-555555555555" }));
    expect(deleteUser).not.toHaveBeenCalled();
  });

  test("removes the new account when the application cannot be saved", async () => {
    submit.mockResolvedValue(Response.json({ error: "Upload your NBI clearance. It is required." }, { status: 400 }));
    const response = await call(valid);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, message: "Upload your NBI clearance. It is required." });
    expect(deleteUser).toHaveBeenCalledWith("11111111-2222-3333-4444-555555555555");
  });

  test("removes the new account when saving throws", async () => {
    submit.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await call(valid);
    expect(response.status).toBe(500);
    expect(deleteUser).toHaveBeenCalledTimes(1);
  });
});
