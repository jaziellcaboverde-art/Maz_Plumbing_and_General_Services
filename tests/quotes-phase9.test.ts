import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  DEFAULT_TIER_CONFIG as cfg, checkMilestones, checkQuoteAmount, depositFor, milestoneTarget, paymentPlanText,
  paymentTierFor, remainingAfterDeposit,
} from "@/lib/quotes/rules";

describe("payment tier (step 9.6)", () => {
  test("below 20,000 is minor, 20,000 to 79,999 is standard, 80,000 and up is large", () => {
    expect(paymentTierFor(19999.99, false)).toBe("minor");
    expect(paymentTierFor(20000, false)).toBe("standard");
    expect(paymentTierFor(79999.99, false)).toBe("standard");
    expect(paymentTierFor(80000, false)).toBe("large");
  });
  test("a major job is large at any price", () => {
    expect(paymentTierFor(5000, true)).toBe("large");
  });
});

describe("deposit rule (Q26, decision #33)", () => {
  test("minor jobs are paid in full, nothing left to pay", () => {
    expect(depositFor(12500, "minor")).toBe(12500);
    expect(remainingAfterDeposit(12500, "minor")).toBe(0);
  });
  test("standard and large jobs pay 50 percent", () => {
    expect(depositFor(40000, "standard")).toBe(20000);
    expect(depositFor(100000, "large")).toBe(50000);
    expect(remainingAfterDeposit(40000, "standard")).toBe(20000);
  });
  test("amounts round to centavos", () => {
    expect(depositFor(10001.01, "standard")).toBe(5000.51);
  });
  test("the large split adds up to the whole quote", () => {
    const amount = 123456.78;
    const parts = depositFor(amount, "large") + milestoneTarget(amount) + (amount - depositFor(amount, "large") - milestoneTarget(amount));
    expect(Math.round(parts * 100)).toBe(Math.round(amount * 100));
  });
  test("the plan text says what the customer pays now", () => {
    expect(paymentPlanText(10000, "minor")).toContain("full");
    expect(paymentPlanText(50000, "standard")).toContain("50%");
    expect(paymentPlanText(100000, "large")).toContain("held until the job is signed off");
  });
});

describe("milestones (step 9.7)", () => {
  const amount = 100000; // milestone share = 40,000
  const ok = [{ title: "Rough-in finished", amount: 15000 }, { title: "Fixtures installed", amount: 25000 }];
  test("2 to 4 milestones adding up to 40 percent pass", () => {
    expect(checkMilestones(ok, amount)).toBeNull();
    expect(checkMilestones([...ok.slice(0, 1), { title: "Fixtures installed", amount: 10000 }, { title: "Final testing", amount: 15000 }], amount)).toBeNull();
  });
  test("one milestone, five milestones and a wrong total fail", () => {
    expect(checkMilestones([ok[0]], amount)).toMatch(/2 to 4/);
    const five = Array.from({ length: 5 }, (_, i) => ({ title: `Stage number ${i}`, amount: 8000 }));
    expect(checkMilestones(five, amount)).toMatch(/2 to 4/);
    expect(checkMilestones([ok[0], { title: "Fixtures installed", amount: 20000 }], amount)).toMatch(/add up/);
  });
  test("short titles and zero amounts fail", () => {
    expect(checkMilestones([{ title: "abc", amount: 15000 }, ok[1]], amount)).toMatch(/title/);
    expect(checkMilestones([{ title: "Rough-in finished", amount: 0 }, ok[1]], amount)).toMatch(/above zero/);
  });
});

describe("quote amount", () => {
  test("must be between 1 and 10,000,000", () => {
    expect(checkQuoteAmount(0)).not.toBeNull();
    expect(checkQuoteAmount(Number.NaN)).not.toBeNull();
    expect(checkQuoteAmount(10_000_001)).not.toBeNull();
    expect(checkQuoteAmount(1500)).toBeNull();
  });
});

describe("migration 20261026150000 (static checks, cannot run the SQL)", () => {
  const dir = join(process.cwd(), "supabase", "migrations");
  const file = readdirSync(dir).find((f) => f.includes("quotes_and_deposit_rules"));
  const sql = file ? readFileSync(join(dir, file), "utf8") : "";
  const code = sql.replace(/--.*$/gm, "");

  test("the file exists and every new function has its permissions set", () => {
    expect(file).toBeTruthy();
    const fns = [...code.matchAll(/create or replace function public\.(\w+)\(/g)].map((m) => m[1]);
    expect(fns.length).toBeGreaterThanOrEqual(9);
    for (const fn of fns) expect(code, fn).toMatch(new RegExp(`revoke all on function public\\.${fn}\\(`));
  });
  test("customer-facing functions are granted to signed-in users only; the expiry job to the server only", () => {
    for (const fn of ["record_site_inspection", "propose_quote", "decide_quote", "respond_to_quote"]) {
      expect(code, fn).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to authenticated;`));
    }
    expect(code).toMatch(/grant execute on function public\.expire_stale_quotes\(uuid\) to service_role;/);
    expect(code).not.toMatch(/grant execute on function public\.expire_stale_quotes\([^)]*\) to authenticated/);
  });
  test("decide_quote is admin only and never edits the provider's price", () => {
    const body = /create or replace function public\.decide_quote[\s\S]*?\n\$\$;/.exec(code)?.[0] ?? "";
    expect(body).toMatch(/public\.is_admin\(\)/);
    expect(body).not.toMatch(/set\s+amount\s*=/);
  });
  test("a customer cannot read a quote before approval", () => {
    expect(code).toMatch(/status in \('approved', 'accepted'\)/);
    expect(code).toMatch(/drop policy if exists "quotes: read as party or admin"/);
  });
  test("the new enum value is not used outside a function body in the same file", () => {
    const outsideFunctions = code.replace(/\$\$[\s\S]*?\$\$/g, "");
    expect(outsideFunctions.replace(/add value if not exists 'expired'/, "")).not.toMatch(/'expired'/);
  });
  test("only server code moves a booking to deposit_paid (the quote functions never do)", () => {
    expect(code).not.toMatch(/change_booking_status\([^)]*'deposit_paid'/);
  });
});
