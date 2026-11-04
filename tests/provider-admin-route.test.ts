import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  admin: vi.fn(),
  provision: vi.fn(),
}));
vi.mock("@/lib/matching/http", () => ({ requireAdmin: mocks.guard }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/provider/provision", () => ({
  provisionProvider: mocks.provision,
}));
import { POST } from "@/app/api/admin/providers/route";
const services = [{ id: "s1", name: "Plumbing", category: "Repair" }];
const row = {
  key: "1",
  firstName: "Juan",
  lastName: "Cruz",
  email: "juan@example.com",
  mobile: "09171234567",
  services: ["s1"],
  password: "provider-password",
  dailyRate: "800",
  serviceArea: "Pasig",
};
const call = (providers: unknown[], source = "manual") =>
  POST(
    new Request("http://localhost/api/admin/providers", {
      method: "POST",
      body: JSON.stringify({ providers, source }),
    }),
  );
beforeEach(() => {
  mocks.guard.mockReset().mockResolvedValue({ user: { id: "admin" } });
  mocks.admin
    .mockReset()
    .mockReturnValue({
      from: () => ({
        select: () => ({ eq: async () => ({ data: services, error: null }) }),
      }),
    });
  mocks.provision
    .mockReset()
    .mockImplementation(async (_admin, _actor, provider) => ({
      key: provider.key,
      email: provider.email,
      status: "created",
      providerId: "new-provider",
    }));
});
test.each([401, 403])(
  "rejects unauthorized callers with %s before opening the privileged client",
  async (status) => {
    mocks.guard.mockResolvedValue({
      error: Response.json({ error: "Denied" }, { status }),
    });
    expect((await call([row])).status).toBe(status);
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.provision).not.toHaveBeenCalled();
  },
);
test("mixed batches only provision valid rows and do not return passwords", async () => {
  const response = await call(
    [row, { ...row, key: "2", email: "invalid" }],
    "csv",
  );
  const body = await response.json();
  expect(body.results.map((item: { status: string }) => item.status)).toEqual([
    "created",
    "failed",
  ]);
  expect(mocks.provision).toHaveBeenCalledOnce();
  expect(mocks.provision.mock.calls[0][1]).toBe("admin");
  expect(mocks.provision.mock.calls[0][3]).toBe("csv");
  expect(JSON.stringify(body)).not.toContain(row.password);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
test("duplicate emails and unknown services cannot provision accounts", async () => {
  await call([row, { ...row, key: "2", email: "JUAN@example.com" }]);
  expect(mocks.provision).not.toHaveBeenCalled();
  await call([{ ...row, services: ["removed-service"] }]);
  expect(mocks.provision).not.toHaveBeenCalled();
});
test("clients cannot override the role or approval actor through row data", async () => {
  await call([
    { ...row, role: "admin", reviewed_by: "attacker", status: "approved" },
  ]);
  expect(mocks.provision.mock.calls[0][2]).not.toHaveProperty("role");
  expect(mocks.provision.mock.calls[0][2]).not.toHaveProperty("reviewed_by");
});
test("empty passwords are not submitted to Auth accidentally", async () => {
  const result = await (await call([{ ...row, password: "" }])).json();
  expect(result.results[0].status).toBe("failed");
  expect(mocks.provision).not.toHaveBeenCalled();
});
test("caps request size and requires distinct row keys", async () => {
  expect(
    (
      await call(
        Array.from({ length: 11 }, (_, i) => ({ ...row, key: String(i) })),
      )
    ).status,
  ).toBe(400);
  expect(
    (await call([row, { ...row, email: "second@example.com" }])).status,
  ).toBe(400);
  expect(mocks.admin).not.toHaveBeenCalled();
});
test("a catalog read failure does not create partial accounts", async () => {
  mocks.admin.mockReturnValue({
    from: () => ({
      select: () => ({
        eq: async () => ({ data: null, error: { message: "Offline" } }),
      }),
    }),
  });
  expect((await call([row])).status).toBe(503);
  expect(mocks.provision).not.toHaveBeenCalled();
});
