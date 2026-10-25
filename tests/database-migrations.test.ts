import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

// Static checks on the SQL files. They cannot run the SQL. npm run check:rls does that,
// against a real Supabase project.

const DIR = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const read = (name: string) => readFileSync(join(DIR, name), "utf8");
const find = (part: string) => {
  const name = files.find((f) => f.includes(part));
  if (!name) throw new Error(`No migration with "${part}" in its name`);
  return read(name);
};

describe("migration files", () => {
  test("names start with a unique 14 digit timestamp", () => {
    const stamps = files.map((f) => f.split("_")[0]);
    for (const stamp of stamps) expect(stamp).toMatch(/^\d{14}$/);
    expect(new Set(stamps).size).toBe(stamps.length);
  });

  test("no migration writes a PostGIS type without the extensions prefix", () => {
    for (const file of files) {
      const sql = read(file).replace(/--.*$/gm, "");
      expect(sql, file).not.toMatch(/(?<!extensions\.)\bgeography\s*\(/);
    }
  });
});

describe("booking status moves", () => {
  const core = find("core_tables");
  const enumBody = /create type public\.booking_status as enum \(([^)]*)\)/.exec(core)?.[1] ?? "";
  const statuses = [...enumBody.matchAll(/'(\w+)'/g)].map((m) => m[1]);

  const movesSql = find("booking_status");
  const moves = [...movesSql.matchAll(/\('(\w+)',\s*'(\w+)',\s*'\{([^}]*)\}'\)/g)].map((m) => ({
    from: m[1],
    to: m[2],
    actors: m[3].split(","),
  }));

  test("the status list has the 14 statuses from phases-plan.md step 2.9", () => {
    expect(statuses).toEqual([
      "draft", "open", "offered", "accepted", "quoted", "deposit_paid", "scheduled",
      "on_the_way", "in_progress", "done", "signed", "balance_paid", "completed", "cancelled",
    ]);
  });

  test("every move uses real statuses and real actors", () => {
    expect(moves.length).toBeGreaterThan(15);
    for (const move of moves) {
      expect(statuses, move.from).toContain(move.from);
      expect(statuses, move.to).toContain(move.to);
      for (const actor of move.actors) expect(["customer", "provider", "admin", "system"]).toContain(actor);
    }
  });

  test("no move starts from a finished booking", () => {
    for (const move of moves) {
      expect(["completed", "cancelled"]).not.toContain(move.from);
    }
  });

  test("every status can be reached, and every unfinished status can move on", () => {
    for (const status of statuses) {
      if (status !== "draft") expect(moves.some((m) => m.to === status), `to ${status}`).toBe(true);
      if (!["completed", "cancelled"].includes(status)) {
        expect(moves.some((m) => m.from === status), `from ${status}`).toBe(true);
      }
    }
  });

  test("the customer cannot cancel after the provider accepts", () => {
    for (const from of ["accepted", "deposit_paid", "scheduled", "on_the_way", "in_progress"]) {
      const cancel = moves.find((m) => m.from === from && m.to === "cancelled");
      expect(cancel, from).toBeDefined();
      expect(cancel?.actors, from).not.toContain("customer");
    }
  });

  test("once the provider is on the way, only admin can cancel", () => {
    const cancel = moves.find((m) => m.from === "on_the_way" && m.to === "cancelled");
    expect(cancel?.actors).toEqual(["admin"]);
  });

  test("a provider cannot submit or sign off on the customer's behalf", () => {
    const submit = moves.find((m) => m.from === "draft" && m.to === "open");
    const sign = moves.find((m) => m.from === "done" && m.to === "signed");
    expect(submit?.actors).not.toContain("provider");
    expect(sign?.actors).not.toContain("provider");
  });
});

describe("config seed", () => {
  const sql = find("audit_and_config");

  test.each(["normal", "urgent"])("%s ranking weights add up to 100", (kind) => {
    const match = new RegExp(`'ranking\\.${kind}',\\s*'(\\{[^']*\\})'`).exec(sql);
    expect(match, kind).not.toBeNull();
    const weights = JSON.parse(match![1]) as Record<string, number>;
    expect(Object.keys(weights).sort()).toEqual(["distance", "past_jobs", "rating", "reliability"]);
    expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBe(100);
  });

  test("large job split adds up to 100 and matches the locked decision", () => {
    const match = /'large\.split',\s*'(\{[^']*\})'/.exec(sql);
    const split = JSON.parse(match![1]) as Record<string, number>;
    expect(split).toEqual({ deposit: 50, milestones: 40, holdback: 10 });
  });

  test("tiers and fees match the locked decisions", () => {
    const tiers = JSON.parse(/'tiers',\s*'(\{[^']*\})'/.exec(sql)![1]) as Record<string, number>;
    expect(tiers.minor_below).toBe(20000);
    expect(tiers.large_from).toBe(80000);
    expect(sql).toMatch(/'cancel\.minor_flat_fee',\s*'1500'/);
    expect(sql).toMatch(/'arrival\.radius_m',\s*'200'/);
    expect(sql).toMatch(/'offer\.window_minutes\.normal',\s*'30'/);
    expect(sql).toMatch(/'offer\.max_misses',\s*'3'/);
  });
});

describe("access rules", () => {
  const rls = find("rls");

  test("browser roles start with no access", () => {
    expect(rls).toMatch(/revoke all on all tables in schema public from anon, authenticated/);
    expect(rls).toMatch(/enable row level security/);
  });

  test("nobody can update their own role or a booking status from the browser", () => {
    const profileGrant = /grant update \(([^)]*)\)\s+on public\.profiles/.exec(rls)?.[1] ?? "";
    expect(profileGrant).not.toMatch(/\brole\b/);
    const bookingGrants = [...rls.matchAll(/grant (?:insert|update) \(([^)]*)\)\s+on public\.bookings/g)].map((m) => m[1]);
    expect(bookingGrants.length).toBe(2);
    for (const cols of bookingGrants) {
      for (const banned of ["status", "quote_total", "deposit_amount", "provider_id", "payment_tier", "miss_count"]) {
        expect(cols, banned).not.toMatch(new RegExp(`\\b${banned}\\b`));
      }
    }
  });

  test("the status function is closed to guests", () => {
    const sql = find("booking_status");
    expect(sql).toMatch(/revoke all on function public\.change_booking_status[^;]*from public, anon/);
    expect(sql).not.toMatch(/grant execute on function public\.change_booking_status[^;]*to[^;]*anon/);
  });

  test("tables that hold customer money are not readable by providers", () => {
    for (const table of ["payments", "cash_records", "receipts"]) {
      const policy = new RegExp(`create policy "${table}:[^"]*" on public\\.${table}[^;]*;`).exec(rls)?.[0] ?? "";
      expect(policy, table).not.toBe("");
      expect(policy, table).not.toMatch(/is_booking_provider/);
    }
  });
});

describe("booking request migration (Phase 6)", () => {
  const sql = find("booking_request").replace(/--.*$/gm, "");

  test("booking photos are private, image only and limited to 5 MB", () => {
    expect(sql).toMatch(/'booking-photos',\s*'booking-photos',\s*false,\s*5242880/);
    expect(sql).not.toMatch(/'application\/pdf'/);
  });

  test("only the customer of a draft can add or remove photos", () => {
    const writes = sql.match(/create policy "booking photos: customer[^;]*;/g) ?? [];
    expect(writes).toHaveLength(2);
    for (const policy of writes) {
      expect(policy).toMatch(/b\.customer_id = \(select auth\.uid\(\)\)/);
      expect(policy).toMatch(/b\.status = 'draft'/);
    }
  });

  test("submit_booking is for signed in users only and moves the status through the one function", () => {
    expect(sql).toMatch(/revoke all on function public\.submit_booking\(uuid, boolean\) from public, anon/);
    expect(sql).toMatch(/grant execute on function public\.submit_booking\(uuid, boolean\) to authenticated/);
    expect(sql).toMatch(/public\.change_booking_status\(p_booking_id, 'open'/);
  });
});

describe("matching and offers migration (Phase 7)", () => {
  const sql = find("matching_and_offers").replace(/--.*$/gm, "");

  test("the browser can only call the functions that check who is asking", () => {
    for (const fn of ["cfg_number", "provider_can_take", "make_offer", "register_offer_miss", "matching_candidates", "offer_next_in_list", "expire_stale_offers"]) {
      expect(sql).not.toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to authenticated`));
    }
    for (const fn of ["pick_provider", "respond_to_offer", "request_foreman_change", "request_admin_help", "decide_foreman_change", "admin_offer", "my_offers"]) {
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon`));
    }
  });

  test("the reliability formula and the 15 minute window are stored in config", () => {
    expect(sql).toMatch(/"accept_rate":40,"on_time":30,"no_cancel":20,"no_show":10/);
    expect(sql).toMatch(/"min_jobs":3,"rating":4\.0,"reliability":70/);
    expect(sql).toMatch(/15/);
  });

  test("only one foreman change request can be pending per booking", () => {
    expect(sql).toMatch(/foreman_change_one_pending[^;]*where status = 'pending'/);
  });

  test("every security definer function pins its search path", () => {
    const defs = sql.match(/create or replace function[^$]*?\$\$/g) ?? [];
    for (const d of defs.filter((x) => /security definer/i.test(x))) expect(d).toMatch(/set search_path/i);
  });
});

describe("job alerts migration (providers who match the skills are told)", () => {
  const sql = find("open_requests_interest").replace(/--.*$/gm, "");

  test("alerts only go to approved providers who declared the service, and only once per booking", () => {
    expect(sql).toMatch(/pp\.status = 'approved'/);
    expect(sql).toMatch(/from public\.provider_services ps where ps\.provider_id = pp\.profile_id and ps\.service_id = v_booking\.service_id/);
    expect(sql).toMatch(/providers_alerted_at is null/);
  });

  test("the alert and ranking functions are server only; providers can only use their own functions", () => {
    expect(sql).toMatch(/grant execute on function public\.alert_matching_providers\(uuid\) to service_role/);
    expect(sql).toMatch(/grant execute on function public\.matching_candidates\(uuid\) to service_role/);
    expect(sql).toMatch(/grant execute on function public\.set_job_interest\(uuid, boolean\) to authenticated/);
  });

  test("a provider's request list never returns the customer or the street", () => {
    const fn = sql.slice(sql.indexOf("function public.open_requests_for_me"), sql.indexOf("function public.set_job_interest"));
    expect(fn).not.toMatch(/customer_id,|line1|mobile|first_name/);
  });
});
