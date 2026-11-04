import { beforeEach, expect, test, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/matching/http", () => ({
  UUID: /^[0-9a-f-]{36}$/i,
  readBody: (request: Request) => request.json(),
  requireAdmin: async () => ({ session: { rpc } }),
  requireUser: async () => ({ session: { rpc } }),
  databaseError: () =>
    Response.json({ error: "Database error" }, { status: 409 }),
}));
vi.mock("@/lib/matching/engine", () => ({ deliverNotifications: vi.fn() }));
import { POST as quote } from "@/app/api/workflow/[id]/route";
import { POST as assign } from "@/app/api/admin/bookings/[id]/team/route";
import { POST as confirm } from "@/app/api/admin/bookings/[id]/appointment/route";
const id = "8408618c-6c09-4583-9c07-47b29372e77a";
const worker = "8408618c-6c09-4583-9c07-47b29372e77b";
const params = { params: Promise.resolve({ id }) };
const request = (body: unknown) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: { assignments: [] }, error: null });
});
test("quotation ignores tampered totals, line items, notes and gateway fees", async () => {
  const response = await quote(
    request({
      action: "admin_quote",
      data: {
        receiptCsv: "description,amount\nPlumbing labor,25.00\nTOTAL,25.00",
        receiptName: "receipt.csv",
        items: [{ description: "Tampered", quantity: 1, unitPrice: 9999 }],
        gatewayFee: 500,
        note: "Tampered note",
        deposit: 0,
        expiresAt: "2030-12-01T00:00:00Z",
        schedule: [],
      },
    }),
    params,
  );
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith(
    "managed_booking_action",
    expect.objectContaining({
      p_data: expect.objectContaining({
        gatewayFee: 0,
        items: [{ description: "Plumbing labor", quantity: 1, unitPrice: 25 }],
      }),
    }),
  );
});
test("invalid receipt totals cannot reach the quotation database action", async () => {
  const response = await quote(
    request({
      action: "admin_quote",
      data: { receiptCsv: "description,amount\nPlumbing labor,25\nTOTAL,20" },
    }),
    params,
  );
  expect(response.status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
test("assigns workers without an offer expiry or manual duration", async () => {
  const response = await assign(
    request({
      workers: [{ providerId: worker, trade: "Plumber" }],
      phase: "execution",
      key: id,
    }),
    params,
  );
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("assign_provider_team", {
    p_booking: id,
    p_workers: [{ providerId: worker, trade: "Plumber" }],
    p_phase: "execution",
    p_key: id,
  });
});
test("confirms several assigned workers atomically", async () => {
  const response = await confirm(request({ leadIds: [worker, id] }), params);
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("confirm_maz_team_appointment", {
    p_booking: id,
    p_workers: [worker, id],
  });
});
test("duplicate confirmation workers cannot reach the database", async () => {
  expect(
    (await confirm(request({ leadIds: [worker, worker] }), params)).status,
  ).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
