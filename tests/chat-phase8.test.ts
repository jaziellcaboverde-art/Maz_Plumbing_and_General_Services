import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

// Static checks on the Phase 8 migration and chat code. The live checks (other users cannot read a
// thread, admin can) run against Supabase with scripts/check-rls.mjs.

const DIR = join(process.cwd(), "supabase", "migrations");
const name = readdirSync(DIR).find((file) => file.includes("chat_phase8"));
const sql = name ? readFileSync(join(DIR, name), "utf8") : "";
const code = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("chat photos (8.3)", () => {
  test("the bucket is private with a 5 MB limit and image types only", () => {
    expect(sql).toMatch(/'chat-photos', 'chat-photos', false, 5242880/);
    expect(sql).toMatch(/array\['image\/jpeg', 'image\/png', 'image\/webp'\]/);
  });

  test("only the booking's customer and provider upload; admin can only read", () => {
    const upload = /create policy "chat photos: parties upload"[\s\S]*?;/.exec(sql)?.[0] ?? "";
    expect(upload).toContain("is_booking_party_text");
    expect(upload).not.toContain("is_admin");
    const read = /create policy "chat photos: parties or admin read"[\s\S]*?;/.exec(sql)?.[0] ?? "";
    expect(read).toContain("is_admin");
  });

  test("a message can only point at a photo in its own booking folder", () => {
    expect(sql).toContain("attachment_path like booking_id::text || '/%'");
  });
});

describe("unread and flags (8.4, 8.6)", () => {
  test("unread tracking is private to each person", () => {
    expect(sql).toMatch(/create policy "message_reads: read own"[\s\S]*?profile_id = \(select auth\.uid\(\)\)/);
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*message_reads/);
  });

  test("only customer and provider of the booking can mark a thread read", () => {
    const fn = /function public\.mark_chat_read[\s\S]*?\$\$;/.exec(sql)?.[0] ?? "";
    expect(fn).toContain("is_booking_customer");
    expect(fn).toContain("is_booking_provider");
  });

  test("only an admin can flag, and every flag is audited", () => {
    const fn = /function public\.flag_message[\s\S]*?\$\$;/.exec(sql)?.[0] ?? "";
    expect(fn).toContain("public.is_admin()");
    expect(fn).toContain("write_audit");
    expect(sql).toMatch(/revoke all on function public\.flag_message\(uuid, boolean, text\) from public, anon/);
  });
});

describe("chat screens", () => {
  test("sending goes through the server route so the other person is told", () => {
    const inbox = code("src/components/chat/chat-inbox.tsx");
    expect(inbox).toContain("/api/bookings/${bookingId}/messages");
    expect(inbox).not.toMatch(/from\("messages"\)\.insert/);
  });

  test("a failed message stays on screen with Retry and Discard (8.8)", () => {
    const inbox = code("src/components/chat/chat-inbox.tsx");
    expect(inbox).toContain("Retry");
    expect(inbox).toContain("Discard");
  });

  test("admin gets Flag and no composer (8.5, 8.6)", () => {
    const inbox = code("src/components/chat/chat-inbox.tsx");
    expect(inbox).toContain('role === "admin" && <button');
    expect(inbox).toContain("Only the customer and assigned provider can send messages");
  });

  test("the chat never shows a phone number (8.10)", () => {
    for (const file of ["src/components/chat/chat-inbox.tsx", "src/lib/chat/load-inbox.ts"]) {
      expect(code(file)).not.toMatch(/mobile|phone/i);
    }
  });

  test("the alert text never carries the message itself", () => {
    const route = code("src/app/api/bookings/[id]/messages/route.ts");
    expect(route).toContain("Open the chat to read and reply.");
    expect(route).toMatch(/event: "chat\.message"/);
  });
});
