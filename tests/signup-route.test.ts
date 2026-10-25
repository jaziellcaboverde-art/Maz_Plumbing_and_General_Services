import { NextRequest } from "next/server";
import { afterEach, describe, expect, test, vi } from "vitest";
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

afterEach(() => vi.unstubAllEnvs());

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
