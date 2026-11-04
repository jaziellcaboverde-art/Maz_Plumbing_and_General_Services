import { expect, test } from "vitest";
import { requestedService } from "@/lib/booking/service-selection";
const services = [
  { id: "leak", name: "Leak Detection & Repair", category: "Plumbing" },
  { id: "wire", name: "Wiring & Rewiring", category: "Electrical" },
];
test("live catalog links select their service by ID", () => {
  expect(requestedService(services, { service: "wire" })).toBe(services[1]);
});
test("fallback catalog links resolve names against actual active services", () => {
  expect(
    requestedService(services, {
      serviceName: " leak detection & repair ",
      category: "plumbing",
    }),
  ).toBe(services[0]);
});
test("unknown IDs and names do not silently select an unrelated service", () => {
  expect(
    requestedService(services, {
      service: "missing",
      serviceName: services[0].name,
    }),
  ).toBeUndefined();
  expect(
    requestedService(services, { serviceName: "Removed service" }),
  ).toBeUndefined();
});
test("duplicate names require a unique category match", () => {
  const duplicates = [
    ...services,
    { id: "other", name: services[0].name, category: "Other" },
  ];
  expect(
    requestedService(duplicates, { serviceName: services[0].name }),
  ).toBeUndefined();
  expect(
    requestedService(duplicates, {
      serviceName: services[0].name,
      category: "Other",
    })?.id,
  ).toBe("other");
});
