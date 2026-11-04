import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { GET } from "@/app/api/admin/bookings/[id]/ml-recommendations/route";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), ranked: vi.fn() }));
vi.mock("@/lib/matching/http", () => ({
  requireAdmin: mocks.admin,
  UUID: /^[0-9a-f-]{36}$/i,
}));
vi.mock("@/lib/matching/engine", () => ({ rankedCandidates: mocks.ranked }));
const id = "11111111-1111-4111-8111-111111111111";
const candidate = {
  providerId: "worker-a",
  firstName: "Ana",
  lastInitial: "B",
  distanceM: 1200,
  avgStars: 4.5,
  finishedJobs: 9,
  score: 80,
};
const call = (booking = id) =>
  GET(new Request("http://localhost/test"), {
    params: Promise.resolve({ id: booking }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({ user: { id: "admin" } });
  mocks.ranked.mockResolvedValue([candidate]);
  vi.stubEnv("KUMPUNINJA_ML_EXPERIMENTAL", "true");
  vi.stubEnv("ML_API_URL", "http://127.0.0.1:8001");
  vi.stubEnv("KUMPUNINJA_ML_KEY", "test-secret");
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
test.each([401, 403])(
  "rejects unauthorized requests (%i) before matching",
  async (status) => {
    mocks.admin.mockResolvedValue({ error: Response.json({}, { status }) });
    expect((await call()).status).toBe(status);
    expect(mocks.ranked).not.toHaveBeenCalled();
  },
);
test("rejects invalid booking IDs", async () => {
  expect((await call("bad")).status).toBe(400);
  expect(mocks.ranked).not.toHaveBeenCalled();
});
test("disabled ML preserves rule order without calling Python", async () => {
  vi.stubEnv("KUMPUNINJA_ML_EXPERIMENTAL", "false");
  const response = await call();
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect((await response.json()).mode).toBe("rule_based");
  expect(fetch).not.toHaveBeenCalled();
});
test("accepts eligible IDs and sends only numeric features and identifiers", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      booking_id: id,
      mode: "synthetic_experimental",
      top_three: [{ provider_id: "worker-a" }],
    }),
  );
  const result = await (await call()).json();
  expect(result.mode).toBe("synthetic_experimental");
  expect(result.top_three[0].name).toBe("Ana B");
  const init = vi.mocked(fetch).mock.calls[0][1]!;
  expect(JSON.parse(init.body as string).candidates).toEqual([
    {
      provider_id: "worker-a",
      distance_km: 1.2,
      average_customer_rating: 4.5,
      prior_jobs_completed: 9,
    },
  ]);
});
test.each([
  {
    booking_id: id,
    mode: "synthetic_experimental",
    top_three: [{ provider_id: "stranger" }],
  },
  {
    booking_id: id,
    mode: "synthetic_experimental",
    top_three: [{ provider_id: "worker-a" }, { provider_id: "worker-a" }],
  },
  { booking_id: id, mode: "synthetic_experimental", top_three: [] },
  {
    booking_id: "other",
    mode: "synthetic_experimental",
    top_three: [{ provider_id: "worker-a" }],
  },
])("falls back for untrusted model output %#", async (body) => {
  vi.mocked(fetch).mockResolvedValue(Response.json(body));
  expect((await (await call()).json()).mode).toBe("rule_based");
});
test("outage preserves baseline", async () => {
  vi.mocked(fetch).mockRejectedValue(new Error("offline"));
  expect((await (await call()).json()).top_three[0].provider_id).toBe(
    "worker-a",
  );
});

test("unknown distances remain usable in the rule-based preview", async () => {
  mocks.ranked.mockResolvedValue([{ ...candidate, distanceM: Infinity }]);
  const result = await (await call()).json();
  expect(result.mode).toBe("rule_based");
  expect(result.top_three[0].distance_km).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

test("omits selected workers from ranking while preserving the eligible dropdown IDs", async () => {
  const selected = "11111111-1111-4111-8111-111111111112";
  mocks.ranked.mockResolvedValue([
    { ...candidate, providerId: selected },
    candidate,
  ]);
  vi.stubEnv("KUMPUNINJA_ML_EXPERIMENTAL", "false");
  const response = await GET(
    new Request(`http://localhost/test?exclude=${selected}`),
    { params: Promise.resolve({ id }) },
  );
  const body = await response.json();
  expect(
    body.top_three.map((p: { provider_id: string }) => p.provider_id),
  ).toEqual(["worker-a"]);
  expect(body.eligible_provider_ids).toEqual([selected, "worker-a"]);
  expect(body.remaining_count).toBe(1);
});

test("rejects invalid exclusion IDs before querying matching", async () => {
  const response = await GET(
    new Request("http://localhost/test?exclude=invalid"),
    { params: Promise.resolve({ id }) },
  );
  expect(response.status).toBe(400);
  expect(mocks.ranked).not.toHaveBeenCalled();
});

test("ML cannot recommend a worker already selected in the form", async () => {
  const selected = "11111111-1111-4111-8111-111111111112";
  mocks.ranked.mockResolvedValue([{ ...candidate, providerId: selected }, candidate]);
  vi.mocked(fetch).mockResolvedValue(Response.json({
    booking_id: id, mode: "synthetic_experimental", top_three: [{ provider_id: selected }],
  }));
  const response = await GET(new Request(`http://localhost/test?exclude=${selected}`), { params: Promise.resolve({ id }) });
  const body = await response.json();
  expect(body.mode).toBe("rule_based");
  expect(body.top_three.map((p: { provider_id: string }) => p.provider_id)).toEqual(["worker-a"]);
  const sent = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
  expect(sent.candidates.map((p: { provider_id: string }) => p.provider_id)).toEqual(["worker-a"]);
});

test("timeout covers a stalled response body", async () => {
  vi.useFakeTimers();
  try {
    vi.mocked(fetch).mockImplementation(
      async (_url, init) =>
        ({
          ok: true,
          json: () =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () =>
                reject(new Error("aborted")),
              );
            }),
        }) as Response,
    );
    const pending = call();
    await vi.advanceTimersByTimeAsync(2501);
    expect((await (await pending).json()).mode).toBe("rule_based");
  } finally {
    vi.useRealTimers();
  }
});
