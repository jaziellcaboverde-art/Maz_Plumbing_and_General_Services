import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const sql = readFileSync("supabase/migrations/20261028120000_provider_quality.sql", "utf8");
const decide = readFileSync("src/app/api/admin/provider-applications/[applicantId]/route.ts", "utf8");
const apply = readFileSync("src/lib/provider/submit-application.ts", "utf8");

describe("provider quality migration", () => {
  test("service claims are closed to the browser", () => {
    expect(sql).toContain("alter table public.provider_service_claims enable row level security");
    expect(sql).not.toMatch(/grant [^;]*provider_service_claims/);
  });
  test("large jobs need finished jobs for automatic offers only", () => {
    expect(sql).toContain("probation.large_job_min_finished");
    expect(sql).toMatch(/not p_check_distance\s+or not \(b\.job_class = 'major' or b\.is_major_renovation\)/);
  });
  test("one open flag per provider and reason", () => {
    expect(sql).toMatch(/create unique index quality_flags_one_open[^;]*where status = 'open'/);
  });
  test("only an admin can resolve a flag and a note is needed", () => {
    expect(sql).toContain("Admin access required");
    expect(sql).toContain("at least 5 characters");
  });
});

describe("provider application rules", () => {
  test("applying stores claims with proof, not approved services", () => {
    expect(apply).toContain('from("provider_service_claims").insert');
    expect(apply).not.toContain('from("provider_services").insert');
    expect(apply).toContain("Every service needs 1 to 3 proof files");
  });
  test("approval needs at least one approved service and honours the interview setting", () => {
    expect(decide).toContain("Approve at least one service");
    expect(decide).toContain("provider.interview_required");
    expect(decide).toContain('from("provider_services").upsert');
  });
});
