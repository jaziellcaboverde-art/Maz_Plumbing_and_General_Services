import { expect, test, vi } from "vitest";
const { connection, createClient } = vi.hoisted(() => ({ connection: vi.fn(), createClient: vi.fn() }));
vi.mock("next/server", () => ({ connection }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("NEXT_REDIRECT"); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
import { loadChatInbox } from "@/lib/chat/load-inbox";

test("chat waits for request time before initializing authentication", async () => {
  let release!: () => void;
  connection.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
  createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } });
  const loading = loadChatInbox("admin");
  expect(createClient).not.toHaveBeenCalled();
  release();
  await expect(loading).rejects.toThrow("NEXT_REDIRECT");
  expect(connection).toHaveBeenCalledOnce();
  expect(createClient).toHaveBeenCalledOnce();
});
