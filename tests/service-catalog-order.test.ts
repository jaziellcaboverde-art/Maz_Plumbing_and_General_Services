import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { sortServices } from "@/lib/services/sort";

const svc = (name: string, active: boolean, sort_order = 0, category = "A") => ({ name, active, sort_order, category });

describe("service catalog order", () => {
  test("inactive services are always last, whatever their display order", () => {
    const sorted = sortServices([svc("Aircon", false, 0), svc("Plumbing", true, 5), svc("Electrical", true, 1), svc("Carpentry", false, 2)]);
    expect(sorted.map((s) => s.name)).toEqual(["Electrical", "Plumbing", "Aircon", "Carpentry"]);
  });

  test("deactivating a service moves it behind every active one", () => {
    const list = [svc("A", true, 0), svc("B", true, 1), svc("C", true, 2)];
    const after = sortServices(list.map((s) => (s.name === "A" ? { ...s, active: false } : s)));
    expect(after.map((s) => s.name)).toEqual(["B", "C", "A"]);
  });

  test("ties fall back to category then name", () => {
    const sorted = sortServices([svc("Z", true, 0, "B"), svc("Y", true, 0, "A"), svc("X", true, 0, "A")]);
    expect(sorted.map((s) => s.name)).toEqual(["X", "Y", "Z"]);
  });
});

describe("service removal rules (migration and API)", () => {
  const dir = join(process.cwd(), "supabase", "migrations");
  const file = readdirSync(dir).find((f) => f.includes("service_remove"))!;
  const sql = readFileSync(join(dir, file), "utf8");
  const route = readFileSync(join(process.cwd(), "src/app/api/admin/services/route.ts"), "utf8");

  test("only an admin can delete, and only an inactive service", () => {
    expect(sql).toMatch(/for delete to authenticated/);
    expect(sql).toMatch(/is_admin\(\)\) and not active/);
  });

  test("the API needs a reason to deactivate or remove, and blocks removal of booked services", () => {
    expect(route).toMatch(/service\.deactivate/);
    expect(route).toMatch(/service\.remove/);
    expect(route).toMatch(/Give a reason for removing/);
    expect(route).toMatch(/Give a reason for deactivating/);
    expect(route).toMatch(/cannot be removed/);
  });
});
