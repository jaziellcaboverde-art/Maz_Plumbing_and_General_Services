import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { getUser, profile, rpc } = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: profile }) }) }),
    rpc,
  }),
}));
import { POST } from "@/app/api/admin/workflow/route";
import { retrieveExpectedCheckout } from "@/lib/payments/reconcile";
const id = "8408618c-6c09-4583-9c07-47b29372e77a";
beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id } } });
  profile.mockResolvedValue({ data: { role: "admin" }, error: null });
  rpc.mockResolvedValue({ data: null, error: null });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const request = (data: unknown) =>
  new Request("http://localhost/api/admin/workflow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
describe("MAZ operations authorization", () => {
  it("rejects signed-out and customer attempts before any mutation", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    expect(
      (
        await POST(
          request({
            operation: "service",
            data: { serviceId: id, policy: "free", due: "admin_agreed" },
          }),
        )
      ).status,
    ).toBe(401);
    profile.mockResolvedValueOnce({ data: { role: "customer" }, error: null });
    expect(
      (
        await POST(
          request({
            operation: "service",
            data: { serviceId: id, policy: "free", due: "admin_agreed" },
          }),
        )
      ).status,
    ).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("requires an explicit selected-service inspection policy", async () => {
    expect(
      (
        await POST(
          request({
            operation: "service",
            data: {
              serviceId: id,
              policy: "all_services_charge_1500",
              due: "admin_agreed",
            },
          }),
        )
      ).status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    expect(
      (
        await POST(
          request({
            operation: "service",
            data: { serviceId: id, policy: "chargeable", due: "before_visit" },
          }),
        )
      ).status,
    ).toBe(200);
    expect(rpc).toHaveBeenCalledWith("configure_managed_service", {
      p_service: id,
      p_policy: "chargeable",
      p_due: "before_visit",
    });
  });
  it("requires a documented moderation reason and rejects unknown RPC operations", async () => {
    expect(
      (
        await POST(
          request({
            operation: "moderate",
            data: { kind: "review", id, hide: true, note: "" },
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request({ operation: "set_user_role", data: { role: "admin" } }),
        )
      ).status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
describe("read-only checkout reconciliation", () => {
  function checkout(status: string, reference = id) {
    vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_test_example");
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          id: "cs_EXISTING",
          attributes: {
            metadata: { payment_id: reference },
            status,
            checkout_url: "https://checkout.paymongo.com/example",
            payments: [],
            line_items: [
              { currency: "PHP", amount: 150000, quantity: 1 },
              { currency: "PHP", amount: 2500, quantity: 1 },
            ],
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }
  it("recovers only the existing checkout, with the complete disclosed charge", async () => {
    const fetch = checkout("active");
    expect(
      (await retrieveExpectedCheckout("cs_EXISTING", id, 1525)).status,
    ).toBe("active");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].method).toBeUndefined();
  });
  it("recognizes canonical expiry without declaring an unpaid charge successful", async () => {
    checkout("expired");
    expect(
      (await retrieveExpectedCheckout("cs_EXISTING", id, 1525)).payment,
    ).toBeNull();
  });
  it("rejects a different payment reference or a missing processing fee", async () => {
    checkout("active", "different-payment");
    await expect(
      retrieveExpectedCheckout("cs_EXISTING", id, 1525),
    ).rejects.toThrow();
    checkout("active");
    await expect(
      retrieveExpectedCheckout("cs_EXISTING", id, 1500),
    ).rejects.toThrow();
  });
});
