import { describe, expect, it } from "vitest";
import { parseReceiptCsv } from "@/lib/workflow/receipt-import";
import { readFileSync } from "node:fs";
describe("expense receipt import", () => {
  it("imports the downloadable sample and independently verifies its total", () => {
    const result = parseReceiptCsv(
      readFileSync("public/samples/quotation-receipt.csv", "utf8"),
    );
    expect(result.total).toBe(4500);
    expect(result.items).toHaveLength(3);
  });
  it("supports BOM, quoted commas and escaped quotes", () => {
    expect(
      parseReceiptCsv(
        '\uFEFFdescription,amount\r\n"Pipe, fittings and ""labor""",12.35\r\nTOTAL,12.35',
      ).total,
    ).toBe(12.35);
  });
  it.each([
    "description,amount\nLabor,50.00\nTOTAL,40.00",
    "description,amount\nLabor,-5\nTOTAL,-5",
    "description,amount\nLabor,1.001\nTOTAL,1.001",
    "description,amount\nLabor,5",
    "description,amount\nTOTAL,5\nTOTAL,5",
    'description,amount\n"Labor,5\nTOTAL,5',
    "description,amount\nLabor,Infinity\nTOTAL,Infinity",
  ])("rejects invalid or mismatched receipt totals: %s", (csv) => {
    expect(() => parseReceiptCsv(csv)).toThrow();
  });
  it("sums currency in cents", () => {
    expect(
      parseReceiptCsv("description,amount\nLabor,0.10\nParts,0.20\nTOTAL,0.30")
        .total,
    ).toBe(0.3);
  });
  it("rejects oversized imports", () => {
    expect(() => parseReceiptCsv("x".repeat(65537))).toThrow(/64 KB/);
  });
});
