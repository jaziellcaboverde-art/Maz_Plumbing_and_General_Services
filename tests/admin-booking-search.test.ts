import { expect, test } from "vitest";
import {
  bookingSearchTerm,
  customerNameFilter,
} from "@/lib/booking/admin-search";

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
