import { describe, expect, test } from "vitest";
import {
  OFFICIAL_STATUSES, customerCanChange, databaseStatusesFor, officialStatus, paymentStatusFor, statusFromSlug, statusSlug, timelineIndex,
} from "@/lib/booking/official-status";
import type { BookingStatus } from "@/lib/booking/rules";

const ALL: BookingStatus[] = [
  "draft", "open", "offered", "accepted", "quoted", "deposit_paid", "scheduled",
  "on_the_way", "in_progress", "done", "signed", "balance_paid", "completed", "cancelled",
];

describe("official booking statuses (spec section 2)", () => {
  test("there are exactly six official names", () => {
    expect(OFFICIAL_STATUSES).toEqual(["Pending", "Accepted", "Assigned", "Ongoing", "Completed", "Cancelled"]);
  });

  test("every database status maps to an official one, except a draft", () => {
    for (const status of ALL) {
      const official = officialStatus(status);
      if (status === "draft") expect(official).toBeNull();
      else expect(OFFICIAL_STATUSES).toContain(official);
    }
  });

  test("the mapping follows the lifecycle", () => {
    expect(officialStatus("open")).toBe("Pending");
    expect(officialStatus("offered")).toBe("Pending");
    expect(officialStatus("accepted")).toBe("Assigned");
    expect(officialStatus("scheduled")).toBe("Assigned");
    expect(officialStatus("in_progress")).toBe("Ongoing");
    expect(officialStatus("done")).toBe("Completed");
    expect(officialStatus("completed")).toBe("Completed");
    expect(officialStatus("cancelled")).toBe("Cancelled");
  });

  test("the timeline only moves forward", () => {
    const order = ALL.filter((status) => !["draft", "cancelled"].includes(status)).map((status) => timelineIndex(officialStatus(status)));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(timelineIndex("Cancelled")).toBe(-1);
    expect(timelineIndex(null)).toBe(-1);
  });

  test("a customer may reschedule or cancel only while Pending", () => {
    const allowed = ALL.filter(customerCanChange);
    expect(allowed).toEqual(["open", "offered"]);
  });

  test("filters round trip and cover every database status once", () => {
    for (const status of OFFICIAL_STATUSES) expect(statusFromSlug(statusSlug(status))).toBe(status);
    expect(statusFromSlug("nope")).toBeNull();
    const covered = OFFICIAL_STATUSES.flatMap(databaseStatusesFor);
    expect([...covered].sort()).toEqual(ALL.filter((status) => status !== "draft").sort());
  });
});

describe("payment status (spec 3.G)", () => {
  test("Unpaid, Partially Paid and Paid", () => {
    expect(paymentStatusFor({ status: "scheduled", quoteTotal: 10000, paidTotal: 0 })).toBe("Unpaid");
    expect(paymentStatusFor({ status: "scheduled", quoteTotal: 10000, paidTotal: 5000 })).toBe("Partially Paid");
    expect(paymentStatusFor({ status: "done", quoteTotal: 10000, paidTotal: 10000 })).toBe("Paid");
    expect(paymentStatusFor({ status: "completed", quoteTotal: null, paidTotal: 0 })).toBe("Paid");
  });

  test("drafts and cancelled bookings have none", () => {
    expect(paymentStatusFor({ status: "draft", quoteTotal: null, paidTotal: 0 })).toBeNull();
    expect(paymentStatusFor({ status: "cancelled", quoteTotal: 500, paidTotal: 0 })).toBeNull();
  });
});
