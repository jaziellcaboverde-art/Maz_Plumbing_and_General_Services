import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20261027100000_customer_support_announcements_prices.sql");

describe("Customer v2 database support", () => {
  test("services have nullable starting prices and notes", () => {
    expect(migration).toMatch(/add column starting_price_php numeric\(12, 2\)/);
    expect(migration).toMatch(/starting_price_php is null or starting_price_php >= 0/);
    expect(migration).toContain("add column price_note text");
  });

  test("support messages have a separate, customer-owned thread", () => {
    expect(migration).toMatch(/customer_id uuid not null unique references public\.profiles/);
    expect(migration).toContain("messages_exactly_one_thread");
    expect(migration).toContain("messages: send as booking party or support party");
    expect(migration).toContain("mark_support_chat_read");
  });

  test("announcement dismissal and critical acknowledgement are modeled per recipient", () => {
    expect(migration).toContain("category in ('booking', 'account', 'announcement')");
    expect(migration).toContain("dismissed_at");
    expect(migration).toContain("requires_ack");
    expect(migration).toContain("notifications_critical_ack_before_dismiss");
  });
});

describe("Customer v2 screens and routes", () => {
  test("service detail books with the selected service and displays only stored prices", () => {
    const detail = read("src/app/(customer)/customer/services/[serviceId]/page.tsx");
    const booking = read("src/app/(customer)/customer/bookings/new/page.tsx");
    expect(detail).toContain("From ${MONEY.format");
    expect(detail).toContain("Price on quote");
    expect(detail).toContain("?service=${service.id}");
    expect(booking).toContain("service?: string");
    expect(booking).toContain("initialValues.serviceId = selectedService.id");
  });

  test("support chat uses its dedicated API and remains separate from booking messages", () => {
    const inbox = read("src/components/chat/chat-inbox.tsx");
    const api = read("src/app/api/support/messages/route.ts");
    expect(inbox).toContain('type === "support" ? "/api/support/messages"');
    expect(inbox).toContain("mark_support_chat_read");
    expect(api).toContain("support_thread_id: supportThreadId");
    expect(api).toContain("MAZ Support replied to your message");
  });

  test("admin announcement broadcasts create per-recipient announcement notifications", () => {
    const route = read("src/app/api/admin/announcements/route.ts");
    const center = read("src/components/notifications/notification-center.tsx");
    expect(route).toContain('event: "announcement.broadcast"');
    expect(route).toContain('category: "announcement"');
    expect(center).toContain("Acknowledge");
    expect(center).toContain("Dismiss");
    expect(center).toContain("Mark all as read");
  });
});
