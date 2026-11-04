import { expect, test } from "vitest";
import {
  bookingSearchTerm,
  customerNameFilter,
  missingManualCustomerColumn,
} from "@/lib/booking/admin-search";
test("schema compatibility only retries the missing manual-customer column", () => {
  expect(missingManualCustomerColumn({ code: "42703", message: "column bookings.manual_customer_name does not exist" })).toBe(true);
  expect(missingManualCustomerColumn({ code: "42501", message: "permission denied" })).toBe(false);
  expect(missingManualCustomerColumn({ code: "42703", message: "column bookings.other_field does not exist" })).toBe(false);
  expect(missingManualCustomerColumn(null)).toBe(false);
});

test("customer names match all words across first and last name, regardless of order", () => {
  expect(customerNameFilter(bookingSearchTerm(" Test   Customer "))).toBe(
    "and(or(first_name.ilike.%Test%,last_name.ilike.%Test%),or(first_name.ilike.%Customer%,last_name.ilike.%Customer%))",
  );
});
test("search terms cannot inject PostgREST operators and retain Unicode names", () => {
  expect(bookingSearchTerm("Peña,()_%")).toBe("Peña");
  expect(bookingSearchTerm("a".repeat(200))).toHaveLength(100);
  expect(bookingSearchTerm()).toBe("");
});
