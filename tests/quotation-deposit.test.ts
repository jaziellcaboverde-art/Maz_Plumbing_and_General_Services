import { expect, test } from "vitest";
import { quotationDeposit } from "@/lib/workflow/deposit";
test("contracts require half of the subtotal with currency rounding", () => {
  expect(quotationDeposit(4500, true)).toBe(2250);
  expect(quotationDeposit(101.01, true)).toBe(50.51);
  expect(quotationDeposit(0.01, true)).toBe(0.01);
});
test("projects without contracts require no advance", () => {
  expect(quotationDeposit(4500, false)).toBe(0);
});
