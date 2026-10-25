import { afterEach, describe, expect, test, vi } from "vitest";
import { cookieOptionsFor, withoutExpiry } from "@/lib/auth/session-policy";
import { isTurnstileEnabled, verifyTurnstile, clientIp } from "@/lib/auth/turnstile";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Turnstile check", () => {
  test("is off and passes when no secret is set", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(isTurnstileEnabled()).toBe(false);
    expect(await verifyTurnstile(undefined)).toBe(true);
  });

  test("fails without a token when a secret is set", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    expect(await verifyTurnstile(undefined)).toBe(false);
    expect(await verifyTurnstile("")).toBe(false);
  });

  test("passes only when Cloudflare says success", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }));
    expect(await verifyTurnstile("token", "1.2.3.4")).toBe(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false }) }));
    expect(await verifyTurnstile("token")).toBe(false);
  });

  test("fails closed when Cloudflare cannot be reached", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await verifyTurnstile("token")).toBe(false);
  });

  test("reads the visitor address from x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("Remember me cookies", () => {
  test("a session only sign in loses its expiry and keeps everything else", () => {
    const options = { path: "/", maxAge: 400, expires: new Date(), httpOnly: true };
    expect(withoutExpiry(options)).toEqual({ path: "/", httpOnly: true });
    expect(cookieOptionsFor(options, true)).toEqual({ path: "/", httpOnly: true });
  });

  test("a remembered sign in is left alone", () => {
    const options = { path: "/", maxAge: 400 };
    expect(cookieOptionsFor(options, false)).toBe(options);
  });
});
