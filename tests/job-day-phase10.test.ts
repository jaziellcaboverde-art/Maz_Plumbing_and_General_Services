import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const day = readFileSync("supabase/migrations/20261028100000_job_day.sql", "utf8");
const reqs = readFileSync("supabase/migrations/20261028110000_provider_requirements.sql", "utf8");

describe("job day migration (10.1 to 10.4, 10.2a)", () => {
  test("only the booking's customer can read the live location, and no trail is kept", () => {
    expect(day).toMatch(/create policy "live_locations: the customer of that booking reads"/);
    expect(day).toContain("booking_id uuid primary key");
    expect(day).toMatch(/delete from public\.live_locations where booking_id = new\.id/);
  });
  test("location is cleared when the booking leaves on_the_way", () => {
    expect(day).toMatch(/old\.status = 'on_the_way' and new\.status <> 'on_the_way'/);
  });
  test("a good check in moves the booking to in_progress, and the radius comes from config", () => {
    expect(day).toContain("'in_progress', 'Provider checked in'");
    expect(day).toContain("arrival.radius_m");
    expect(day).toMatch(/v_distance <= v_radius/);
  });
  test("a closed work day cannot be checked into again", () => {
    expect(day).toMatch(/where public\.work_days\.closed_at is null/);
  });
  test("closing a day needs 1 to 10 photos from this booking", () => {
    expect(day).toMatch(/cardinality\(p_photo_paths\) < 1 or cardinality\(p_photo_paths\) > 10/);
    expect(day).toContain("A photo does not belong to this booking");
  });
  test("reminders are server only", () => {
    expect(day).toMatch(/grant execute on function public\.send_schedule_reminders\(\) to service_role/);
  });
});

describe("provider requirements migration", () => {
  test("adds the new document kinds and the references", () => {
    for (const word of ["proof_of_address", "skill_certificate", "reference_1_phone", "reference_2_phone", "years_experience"]) expect(reqs).toContain(word);
  });
  test("NBI clearance is required by default", () => {
    expect(reqs).toContain("'provider.nbi_clearance_required', 'true'");
  });
});
