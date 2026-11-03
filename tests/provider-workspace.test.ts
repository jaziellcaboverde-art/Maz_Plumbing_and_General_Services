import { beforeEach, describe, expect, test, vi } from "vitest";
import { manilaInputToISO } from "@/lib/provider/time";
import { ownWorkCompleted } from "@/lib/provider/rules";

const { rpc, getUser, notify, proposal } = vi.hoisted(() => ({
  rpc: vi.fn(),
  getUser: vi.fn(),
  notify: vi.fn(),
  proposal: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: proposal,
    };
    return { rpc, auth: { getUser }, from: () => query };
  },
}));
vi.mock("@/lib/provider/notify", () => ({ notifyProviderSubmission: notify }));
import { POST } from "@/app/api/provider/work-updates/route";
import { POST as saveHours } from "@/app/api/provider/weekly-hours/route";
import { POST as respondAppointment } from "@/app/api/bookings/[id]/appointment-response/route";

const bookingId = "11111111-2222-3333-4444-555555555555";
const key = "22222222-2222-3333-4444-555555555555";
const valid = {
  bookingId,
  key,
  kind: "inspection",
  notes: "Measured the damaged pipe and identified a leak.",
  photoPaths: [],
};
const request = (body: unknown) =>
  new Request("http://localhost/api/provider/work-updates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "worker" } } });
  proposal.mockResolvedValue({ data: { id: "proposal" }, error: null });
  rpc.mockResolvedValue({ data: "update-id", error: null });
  notify.mockResolvedValue(undefined);
});

describe("customer appointment consent", () => {
  test("requires an explicit boolean decision", async () => {
    const response = await respondAppointment(
      request({ proposalId: key, accept: "yes" }),
      { params: Promise.resolve({ id: bookingId }) },
    );
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  test("does not respond to a proposal hidden by booking access rules", async () => {
    proposal.mockResolvedValue({ data: null });
    const response = await respondAppointment(
      request({ proposalId: key, accept: true }),
      { params: Promise.resolve({ id: bookingId }) },
    );
    expect(response.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });
  test("records consent separately from confirmation of the booking", async () => {
    const response = await respondAppointment(
      request({ proposalId: key, accept: true }),
      { params: Promise.resolve({ id: bookingId }) },
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledExactlyOnceWith(
      "respond_provider_appointment",
      { p_request: key, p_accept: true },
    );
  });
});

describe("independent team completion", () => {
  test("a worker finishes their accepted phases without closing the lead's project", () => {
    expect(
      ownWorkCompleted("plumber", "foreman", ["completed", "completed"]),
    ).toBe(true);
    expect(ownWorkCompleted("foreman", "foreman", ["completed"])).toBe(false);
  });
  test("outstanding phases and replacement requests stay active", () => {
    expect(
      ownWorkCompleted("plumber", "foreman", ["completed", "accepted"]),
    ).toBe(false);
    expect(
      ownWorkCompleted("plumber", "foreman", ["withdrawal_requested"]),
    ).toBe(false);
    expect(ownWorkCompleted("plumber", "foreman", [])).toBe(false);
  });
});

describe("Philippine calendar input", () => {
  test("uses Philippine time independently of the device timezone", () => {
    expect(manilaInputToISO("2026-11-03T08:30")).toBe(
      "2026-11-03T00:30:00.000Z",
    );
    expect(manilaInputToISO("2026-11-03T00:15")).toBe(
      "2026-11-02T16:15:00.000Z",
    );
  });
  test("rejects impossible or malformed calendar values", () => {
    for (const input of [
      "",
      "2026-02-30T08:00",
      "2026-13-03T08:00",
      "2026-11-03T24:00",
      "2026-11-03",
    ])
      expect(manilaInputToISO(input)).toBeNull();
  });
});
describe("provider work submission", () => {
  test("requires authentication", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request(valid))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  test("does not submit malformed evidence or missing completion evidence", async () => {
    for (const body of [
      { ...valid, photoPaths: [123] },
      { ...valid, notes: "short" },
      { ...valid, kind: "completion" },
      { ...valid, kind: "milestone", photoPaths: ["photo.jpg"] },
    ])
      expect((await POST(request(body))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  test("preserves the retry key and submits advisory findings for database authorization", async () => {
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "submit_provider_work_update",
      expect.objectContaining({
        p_booking: bookingId,
        p_key: key,
        p_kind: "inspection",
        p_milestone: null,
      }),
    );
    expect(notify).toHaveBeenCalledWith(
      bookingId,
      "Provider work submitted for review",
    );
  });
  test("surfaces assignment access denial and never sends an approval notification", async () => {
    rpc.mockResolvedValue({
      error: {
        code: "42501",
        message: "Only an active assigned provider can submit work",
      },
    });
    expect((await POST(request(valid))).status).toBe(403);
    expect(notify).not.toHaveBeenCalled();
  });
  test("a failed notification does not undo a saved submission", async () => {
    notify.mockRejectedValue(new Error("delivery offline"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(request(valid))).status).toBe(200);
    log.mockRestore();
  });
});
describe("weekly hours", () => {
  test("rejects duplicate days, overnight hours and invalid clock times", async () => {
    for (const hours of [
      [{ weekday: 1, start: "17:00", end: "08:00" }],
      [{ weekday: 1, start: "25:00", end: "26:00" }],
      [
        { weekday: 1, start: "08:00", end: "17:00" },
        { weekday: 1, start: "09:00", end: "18:00" },
      ],
    ])
      expect((await saveHours(request({ hours }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  test("allows an explicit empty weekly calendar without inventing working days", async () => {
    expect((await saveHours(request({ hours: [] }))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("save_provider_weekly_hours", {
      p_hours: [],
    });
  });
});
