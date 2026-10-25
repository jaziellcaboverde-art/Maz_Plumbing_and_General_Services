import { describe, expect, test } from "vitest";
import {
  draftColumns, fromLocalInputValue, jobClassFor, missingForSubmit, toLocalInputValue, valuesFromDraft,
  type DraftValues,
} from "@/lib/booking/rules";

const services = [
  { id: "s-minor", defaultClass: "minor" as const, urgentAllowed: false },
  { id: "s-urgent", defaultClass: "minor" as const, urgentAllowed: true },
  { id: "s-major", defaultClass: "major" as const, urgentAllowed: false },
];
const addresses = [{ id: "a-pin", hasPin: true }, { id: "a-nopin", hasPin: false }];
const now = new Date("2026-11-01T00:00:00");
const complete: DraftValues = {
  serviceId: "s-minor",
  description: "Kitchen sink leaks under the cabinet",
  addressId: "a-pin",
  isUrgent: false,
  isMajorRenovation: false,
  preferredStartLocal: "2026-11-05T09:00",
  termsAccepted: true,
};

describe("missing field messages (step 6.9)", () => {
  test("a complete request has nothing missing", () => {
    expect(missingForSubmit(complete, services, addresses, now)).toEqual([]);
  });

  test("an empty request lists exactly what is missing", () => {
    const empty: DraftValues = { ...complete, serviceId: "", description: "", addressId: "", preferredStartLocal: "", termsAccepted: false };
    expect(missingForSubmit(empty, services, addresses, now)).toEqual([
      "Choose a service",
      "Describe the job in at least 10 characters",
      "Choose a service address",
      "Choose a date and time, or switch on urgent",
      "Read and accept the Terms",
    ]);
  });

  test("an address without a map pin is not enough", () => {
    expect(missingForSubmit({ ...complete, addressId: "a-nopin" }, services, addresses, now)).toEqual(["Add a map pin to your service address"]);
  });

  test("a past date is refused", () => {
    expect(missingForSubmit({ ...complete, preferredStartLocal: "2026-10-30T09:00" }, services, addresses, now)).toEqual(["Choose a date and time in the future"]);
  });

  test("urgent replaces the date, but only for services that allow it", () => {
    const urgent = { ...complete, isUrgent: true, preferredStartLocal: "" };
    expect(missingForSubmit({ ...urgent, serviceId: "s-urgent" }, services, addresses, now)).toEqual([]);
    expect(missingForSubmit(urgent, services, addresses, now)).toEqual(["Urgent requests are not available for this service"]);
  });
});

describe("major flag (step 6.5)", () => {
  test("major when ticked or when the service is major", () => {
    expect(jobClassFor(services[0], false)).toBe("minor");
    expect(jobClassFor(services[0], true)).toBe("major");
    expect(jobClassFor(services[2], false)).toBe("major");
  });
});

describe("draft resume and save (step 6.8)", () => {
  test("a saved draft comes back as the same form values", () => {
    const row = {
      service_id: "s-urgent", description: "Burst pipe", address_id: "a-pin",
      preferred_start: fromLocalInputValue("2026-11-05T09:30"), is_urgent: false, is_major_renovation: true, terms_accepted_at: null,
    };
    expect(valuesFromDraft(row)).toEqual({
      serviceId: "s-urgent", description: "Burst pipe", addressId: "a-pin", isUrgent: false,
      isMajorRenovation: true, preferredStartLocal: "2026-11-05T09:30", termsAccepted: false,
    });
  });

  test("no draft gives empty values", () => {
    expect(valuesFromDraft(null)).toMatchObject({ serviceId: "", description: "", isUrgent: false, termsAccepted: false });
  });

  test("saved columns drop the date when urgent and store empty text as null", () => {
    expect(draftColumns({ ...complete, isUrgent: true, description: "  " })).toMatchObject({ preferred_start: null, description: null, is_urgent: true });
  });

  test("local input values round trip", () => {
    expect(toLocalInputValue(fromLocalInputValue("2026-12-24T18:00"))).toBe("2026-12-24T18:00");
    expect(toLocalInputValue(null)).toBe("");
    expect(fromLocalInputValue("")).toBeNull();
  });
});
