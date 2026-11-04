import { expect, test } from "vitest";
import {
  MAX_IMPORT_ROWS,
  parseProviderCsv,
  providerCsvTemplate,
  validateProviders,
} from "@/lib/provider/admin-import";

const services = [
  { id: "service-1", name: "Leak Detection & Repair", category: "Plumbing" },
  { id: "service-2", name: "Wiring, outlets & lights", category: "Electrical" },
];
const valid = {
  key: "1",
  firstName: "Juan",
  lastName: "Dela Cruz",
  email: "JUAN@example.com",
  mobile: "0917 123 4567",
  services: ["service-1"],
  password: "",
  dailyRate: "800.25",
  serviceArea: "Pasig",
};
test("manual provider rows normalize email, phone and money without needing an application", () => {
  expect(validateProviders([valid], services)[0]).toMatchObject({
    errors: [],
    value: {
      email: "juan@example.com",
      mobile: "+639171234567",
      dailyRate: 800.25,
      serviceIds: ["service-1"],
    },
  });
});
test.each(["+639171234567", "639171234567", "09171234567", "9171234567"])(
  "accepts a complete Philippine mobile: %s",
  (mobile) => {
    expect(
      validateProviders([{ ...valid, mobile }], services)[0].value?.mobile,
    ).toBe("+639171234567");
  },
);
test("does not truncate oversized mobile numbers or silently accept invalid fields", () => {
  for (const patch of [
    { mobile: "091712345678" },
    { email: "invalid" },
    { dailyRate: "-1" },
    { dailyRate: "1.001" },
    { password: "short" },
    { services: [] },
    { services: ["unknown"] },
  ])
    expect(
      validateProviders([{ ...valid, ...patch }], services)[0].errors.length,
    ).toBeGreaterThan(0);
});
test("duplicate emails block every duplicate row before account creation", () => {
  expect(
    validateProviders(
      [valid, { ...valid, key: "2", email: "juan@example.com" }],
      services,
    ).every(
      (row) =>
        !row.value &&
        row.errors.some((error) => error.includes("more than once")),
    ),
  ).toBe(true);
});
test("services accept exact names or category-qualified names, reject ambiguity and deduplicate IDs", () => {
  expect(
    validateProviders(
      [
        {
          ...valid,
          services: ["plumbing::leak detection & repair", "service-1"],
        },
      ],
      services,
    )[0].value?.serviceIds,
  ).toEqual(["service-1"]);
  expect(
    validateProviders(
      [{ ...valid, services: [services[0].name] }],
      [...services, { ...services[0], id: "another", category: "Other" }],
    )[0].value,
  ).toBeUndefined();
});
test("CSV handles BOM, CRLF, commas, escaped quotes and multiple services", () => {
  const csv =
    '\uFEFFfirst_name,last_name,email,mobile,services,daily_rate,service_area\r\nJuan,"Dela ""Cruz""",juan@example.com,09171234567,"Leak Detection & Repair|Wiring, outlets & lights",800,"Pasig, Marikina"\r\n';
  const [row] = parseProviderCsv(csv);
  expect(row).toMatchObject({
    lastName: 'Dela "Cruz"',
    serviceArea: "Pasig, Marikina",
    services: ["Leak Detection & Repair", "Wiring, outlets & lights"],
  });
  expect(validateProviders([row], services)[0].value?.serviceIds).toEqual([
    "service-1",
    "service-2",
  ]);
});
test("downloaded template round-trips with optional generated passwords", () => {
  const rows = parseProviderCsv(providerCsvTemplate(services));
  expect(validateProviders(rows, services)[0].errors).toEqual([]);
  expect(rows[0].password).toBe("");
});
test.each([
  "",
  "first_name,email\nJuan,juan@example.com",
  'first_name,last_name,email,mobile,services\n"Juan,Cruz,j@example.com,09171234567,service-1',
  "first_name,last_name,email,mobile,services\nJuan,Cruz,j@example.com,09171234567,service-1,extra",
  "first_name,last_name,email,mobile,services,__proto__\nJuan,Cruz,j@example.com,09171234567,service-1,test",
])("rejects malformed CSV without creating rows: %s", (csv) =>
  expect(() => parseProviderCsv(csv)).toThrow(),
);
test("CSV row and file-size limits are enforced before upload", () => {
  const header = "first_name,last_name,email,mobile,services\n";
  expect(() =>
    parseProviderCsv(
      header +
        Array.from(
          { length: MAX_IMPORT_ROWS + 1 },
          (_, i) => `Juan,Cruz,j${i}@example.com,09171234567,service-1`,
        ).join("\n"),
    ),
  ).toThrow(/between/);
  expect(() => parseProviderCsv("x".repeat(256 * 1024 + 1))).toThrow(/256 KB/);
});
