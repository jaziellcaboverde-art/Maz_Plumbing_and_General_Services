import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  client: vi.fn(),
}));
vi.mock("next/server", () => ({ connection: mocks.connection }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { loadWorkspaceIdentity } from "@/lib/auth/workspace-identity";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connection.mockResolvedValue(undefined);
  mocks.client.mockResolvedValue({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
});

test("reads verified identity at request time and loads only that user's profile", async () => {
  const user = { id: "user-a", app_metadata: { role: "customer" } };
  mocks.getUser.mockResolvedValue({ data: { user } });
  mocks.maybeSingle.mockResolvedValue({
    data: { role: "admin", first_name: "Staff" },
    error: null,
  });
  const result = await loadWorkspaceIdentity();
  expect(mocks.connection.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.client.mock.invocationCallOrder[0],
  );
  expect(mocks.eq).toHaveBeenCalledWith("id", user.id);
  expect(result.user).toEqual(user);
  expect(result.profile?.role).toBe("admin");
});

test("a signed-out request never loads a profile", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  const result = await loadWorkspaceIdentity();
  expect(result.user).toBeNull();
  expect(result.profile).toBeNull();
  expect(mocks.from).not.toHaveBeenCalled();
});

test("profile failures remain available to access guards", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-b" } } });
  const error = { message: "Temporarily unavailable" };
  mocks.maybeSingle.mockResolvedValue({ data: null, error });
  const result = await loadWorkspaceIdentity();
  expect(result.profile).toBeNull();
  expect(result.profileError).toEqual(error);
});
