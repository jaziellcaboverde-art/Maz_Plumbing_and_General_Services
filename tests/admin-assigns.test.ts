import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const sql = readFileSync("supabase/migrations/20261028130000_admin_assigns_providers.sql", "utf8");
const start = readFileSync("src/app/api/bookings/[id]/start-matching/route.ts", "utf8");

describe("admin assigns providers for normal jobs", () => {
  test("the customer cannot pick unless config matching.customer_pick is 1", () => {
    expect(sql).toContain("matching.customer_pick");
    expect(sql).toContain("Our team chooses the provider for your job");
  });
  test("a declined normal job goes back to the admin, not the customer", () => {
    expect(sql).toMatch(/cfg_number\('matching\.customer_pick', 0\) = 1 then\s+v_next := 'customer'/);
    expect(sql).toMatch(/else\s+v_next := 'admin'/);
  });
  test("a new normal job is put in the admin queue and the admins are told", () => {
    expect(start).toContain("customerPicksProvider");
    expect(start).toContain("Choose a provider for this customer from the ranked list.");
  });
});
