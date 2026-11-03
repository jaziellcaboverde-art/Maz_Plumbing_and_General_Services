import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

test.each([
  "src/components/ui/settings-screen.tsx",
  "src/app/(customer)/customer/settings/address-section.tsx",
  "src/app/(provider)/provider/settings/page.tsx",
  "src/app/(admin)/admin/users/page.tsx",
  "src/app/(admin)/admin/provider-applications/page.tsx",
  "src/app/(admin)/admin/services/page.tsx",
  "src/app/(customer)/customer/bookings/new/page.tsx",
])("%s waits for request time before initializing authenticated data access", file => {
  const source = readFileSync(join(process.cwd(), file), "utf8");
  const requestBoundary = source.indexOf("await connection()");
  const sessionCreation = source.indexOf("await createClient()");
  expect(requestBoundary).toBeGreaterThan(-1);
  expect(sessionCreation).toBeGreaterThan(requestBoundary);
});
