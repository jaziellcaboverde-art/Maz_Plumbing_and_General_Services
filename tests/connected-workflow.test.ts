import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  parseWorkflowAction,
  canEditCompanyReview,
  remainingBalance,
} from "@/lib/workflow/rules";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/booking/rules";
import {
  verifiedCheckoutPayment,
  verifiedGatewayRefund,
  createCheckout,
} from "@/lib/payments/paymongo";
const id = "8408618c-6c09-4583-9c07-47b29372e77a";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("managed business decisions", () => {
  it("binds approval to a quotation version and requires explicit review-publication consent", () => {
    expect(
      parseWorkflowAction("respond_quote", { id, accept: true }),
    ).toBeNull();
    expect(
      parseWorkflowAction("respond_quote", { id, version: 2, accept: true }),
    ).not.toBeNull();
    expect(
      parseWorkflowAction("company_review", {
        stars: 5,
        note: "Good",
        attribution: "anonymous",
      }),
    ).toBeNull();
    expect(
      parseWorkflowAction("admin_publish", {
        title: "Repair",
        note: "Reviewed project photos",
        photos: ["private/file.jpg"],
        privacyChecked: false,
      }),
    ).toBeNull();
  });
  it("requires a refund to identify the real payment and positive amount", () => {
    expect(
      parseWorkflowAction("customer_request", {
        kind: "refund",
        note: "Please review the overpayment",
        key: id,
      }),
    ).toBeNull();
    expect(
      parseWorkflowAction("customer_request", {
        kind: "refund",
        note: "Please review the overpayment",
        key: id,
        paymentId: id,
        amount: 1500,
      }),
    ).not.toBeNull();
  });
  it("does not subtract inspection money twice and limits review editing to 14 days", () => {
    expect(remainingBalance(10000, 1500)).toBe(8500);
    expect(
      canEditCompanyReview(
        "2026-11-01T00:00:00Z",
        new Date("2026-11-15T00:00:00Z"),
      ),
    ).toBe(true);
    expect(
      canEditCompanyReview(
        "2026-11-01T00:00:00Z",
        new Date("2026-11-15T00:00:01Z"),
      ),
    ).toBe(false);
  });
  it("saves and displays Philippine time regardless of the device timezone", () => {
    expect(fromLocalInputValue("2026-11-05T09:30")).toBe(
      "2026-11-05T01:30:00.000Z",
    );
    expect(toLocalInputValue("2026-11-05T01:30:00Z")).toBe("2026-11-05T09:30");
    expect(fromLocalInputValue("2026-02-30T09:30")).toBeNull();
  });
});
describe("canonical PayMongo verification", () => {
  const payment = {
    id: "pay_REAL",
    attributes: {
      status: "paid",
      currency: "PHP",
      amount: 152500,
      source: { type: "gcash" },
    },
  };
  function mockCheckout(paid = payment, reference = id) {
    vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_test_example");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({
            data: {
              id: "cs_REAL",
              attributes: {
                metadata: { payment_id: reference },
                payments: [
                  { id: "pay_FAILED", attributes: { status: "failed" } },
                  paid,
                ],
              },
            },
          }),
        ),
    );
  }
  it("retrieves the checkout and accepts its successful payment after an earlier failed attempt", async () => {
    mockCheckout();
    expect((await verifiedCheckoutPayment("cs_REAL", id, 152500)).id).toBe(
      "pay_REAL",
    );
  });
  it.each(["amount", "currency", "reference"])(
    "rejects a canonical %s mismatch even when a webhook claims success",
    async (field) => {
      mockCheckout(
        {
          ...payment,
          attributes: {
            ...payment.attributes,
            ...(field === "amount"
              ? { amount: 150000 }
              : field === "currency"
                ? { currency: "USD" }
                : {}),
          },
        },
        field === "reference" ? "another-booking" : id,
      );
      await expect(
        verifiedCheckoutPayment("cs_REAL", id, 152500),
      ).rejects.toThrow();
    },
  );
  it("discloses processing fees as a separate line item", async () => {
    vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_test_example");
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          data: {
            id: "cs_REAL",
            attributes: {
              checkout_url: "https://checkout.paymongo.com/example",
            },
          },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    await createCheckout({
      paymentId: id,
      bookingId: id,
      amount: 1500,
      processingFee: 25,
      description: "Inspection",
      origin: "https://example.com",
    });
    const sent = JSON.parse(fetch.mock.calls[0][1].body);
    expect(
      sent.data.attributes.line_items.map((i: { amount: number }) => i.amount),
    ).toEqual([150000, 2500]);
  });
  it("does not count a processing refund as settled", async () => {
    vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_test_example");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({
            data: {
              id: "ref_REAL",
              attributes: {
                payment_id: "pay_REAL",
                amount: 150000,
                currency: "PHP",
                status: "processing",
              },
            },
          }),
        ),
    );
    await expect(
      verifiedGatewayRefund("ref_REAL", "pay_REAL", 150000),
    ).rejects.toThrow();
  });
});
