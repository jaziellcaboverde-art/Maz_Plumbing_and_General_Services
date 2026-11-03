import { beforeEach, expect, test, vi } from "vitest";
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
import { POST } from "@/app/api/admin/bookings/[id]/available-slots/route";
const id = "8408618c-6c09-4583-9c07-47b29372e77a";
const body = {
  providerIds: [id],
  from: "2030-11-05",
  after: "2030-11-05T01:00:00Z",
  duration: 60,
  buffer: 30,
};
const call = (data: unknown = body) =>
  POST(
    new Request("http://localhost/available-slots", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    { params: Promise.resolve({ id }) },
  );
beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id } } });
  profile.mockResolvedValue({ data: { role: "admin" }, error: null });
  rpc.mockResolvedValue({ data: [], error: null });
});
test("availability details require an administrator", async () => {
  getUser.mockResolvedValueOnce({ data: { user: null } });
  expect((await call()).status).toBe(401);
  profile.mockResolvedValueOnce({ data: { role: "provider" }, error: null });
  expect((await call()).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});
test("rejects duplicate workers and unsupported duration", async () => {
  expect((await call({ ...body, providerIds: [id, id] })).status).toBe(400);
  expect((await call({ ...body, duration: 900 })).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
test("uses authoritative availability and never caches the response", async () => {
  rpc.mockResolvedValueOnce({
    data: [
      {
        starts_at: "2030-11-06T09:00:00+08:00",
        ends_at: "2030-11-06T10:00:00+08:00",
      },
    ],
    error: null,
  });
  const response = await call();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({
    slots: [
      {
        starts_at: "2030-11-06T01:00:00.000Z",
        ends_at: "2030-11-06T02:00:00.000Z",
      },
    ],
  });
  expect(rpc).toHaveBeenCalledWith("admin_available_team_slots", {
    p_booking: id,
    p_providers: [id],
    p_from: "2030-11-05",
    p_after: body.after,
    p_days: 14,
    p_duration: 60,
    p_buffer: 30,
  });
});
