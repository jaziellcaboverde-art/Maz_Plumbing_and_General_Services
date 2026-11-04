import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { bookingApprovalState } from "@/lib/workflow/approval-state";
import type {
  ManagedBooking,
  WorkflowQuote,
  WorkflowSummary,
} from "@/lib/workflow/load";
import { ApprovalPanels } from "@/components/workflow/approval-panels";
import { parseWorkflowAction } from "@/lib/workflow/rules";
import { QuoteBuilder } from "@/components/workflow/quote-builder";
const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/matching/client", () => ({ postJson: post }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);
const booking = {
  id: "booking",
  status: "quoted",
  provider_id: "lead",
  admin_accepted_at: "2026-11-01T00:00:00Z",
  contract_required: false,
  scheduled_start: "2026-11-05T01:00:00Z",
  execution_confirmed_at: "2026-11-01T00:00:00Z",
} as ManagedBooking;
const quote = {
  id: "quote",
  version: 1,
  status: "accepted",
  amount: 10750,
  deposit_amount: 5375,
  notes: "Aircon cleaning, approved scope",
  line_items: [],
  payment_schedule: [],
  expires_at: null,
  accepted_at: "2026-11-01T01:00:00Z",
} as WorkflowQuote;
const summary: WorkflowSummary = {
  net_paid: 5375,
  inspection_due: 0,
  deposit_due: 0,
  milestone_due: 0,
  balance_due: 0,
  team: [],
};
const input = {
  booking,
  quotes: [quote],
  documents: [],
  summary,
  assignments: [
    {
      provider_id: "lead",
      phase: "execution",
      trade: "Technician",
      status: "accepted",
      required: true,
    },
  ],
  evidence: [],
  milestones: [],
};

test("approved demo payment is separate from remaining balance and optional contracts", () => {
  const state = bookingApprovalState({
    ...input,
    booking: { ...booking, status: "in_progress" },
    evidence: [
      { provider_id: "lead", kind: "completion", review_status: "pending" },
    ],
  });
  expect(state.contractState).toBe("Contract Not Required");
  expect(state.paymentState).toBe("Required Payment Verified");
  expect(state.currentDue).toBe(0);
  expect(quote.amount - summary.net_paid).toBe(5375);
  expect(state.next.title).toBe("Review Work Evidence");
  expect(state.completionBlocks).not.toHaveLength(0);
});
test("simple repairs do not acquire a deposit or extra-work prerequisite", () => {
  const state = bookingApprovalState({
    ...input,
    quotes: [{ ...quote, deposit_amount: 0 }],
    summary: { ...summary, net_paid: 0 },
  });
  expect(state.requiredBeforeWork).toBe(0);
  expect(state.paymentState).toBe("No Upfront Payment Required");
  expect(state.startBlocks).toHaveLength(0);
});
test("required contracts and pending manual payments do block work", () => {
  let state = bookingApprovalState({
    ...input,
    booking: { ...booking, contract_required: true },
  });
  expect(state.next.title).toBe("Create Required Contract");
  state = bookingApprovalState({
    ...input,
    pendingClaims: true,
    summary: { ...summary, net_paid: 0, deposit_due: 5375 },
  });
  expect(state.paymentState).toBe("Pending Manual Verification");
  expect(state.startBlocks).toContain(
    "Verify the payment required before work.",
  );
});
test("multi-worker requirements allow replacements and require every completion", () => {
  const assignments = [
    ...input.assignments,
    {
      provider_id: "old",
      phase: "execution",
      trade: "Electrician",
      status: "declined",
      required: true,
    },
    {
      provider_id: "new",
      phase: "execution",
      trade: "Electrician",
      status: "accepted",
      required: true,
    },
  ];
  expect(
    bookingApprovalState({ ...input, assignments }).startBlocks,
  ).toHaveLength(0);
  expect(
    bookingApprovalState({
      ...input,
      assignments,
      evidence: [
        { provider_id: "lead", kind: "completion", review_status: "approved" },
      ],
    }).completionBlocks,
  ).not.toHaveLength(0);
  const completed = assignments.map((a) => ({
    ...a,
    status: a.status === "accepted" ? "completed" : a.status,
  }));
  expect(
    bookingApprovalState({
      ...input,
      assignments: completed,
      evidence: [
        { provider_id: "lead", kind: "completion", review_status: "approved" },
      ],
      milestones: [{ status: "confirmed" }],
    }).completionBlocks,
  ).toHaveLength(0);
});
test("inspection can precede quotation; completion does not mean final payment", () => {
  const state = bookingApprovalState({
    ...input,
    booking: {
      ...booking,
      inspection_required: true,
      inspection_pay_before_visit: true,
    },
    quotes: [],
    summary: { ...summary, inspection_due: 1500 },
  });
  expect(state.next.title).toBe("Verify Inspection Payment");
  expect(
    bookingApprovalState({
      ...input,
      booking: { ...booking, status: "done" },
      summary: { ...summary, balance_due: 5375 },
    }).currentDue,
  ).toBe(5375);
});
test("approved quotation is compact; contract and extra-work forms open only when requested", () => {
  const state = bookingApprovalState({
    ...input,
    booking: { ...booking, contract_required: true },
  });
  render(
    <ApprovalPanels
      bookingId="booking"
      state={state}
      contractRequired
      quotes={[quote]}
      documents={[]}
      milestones={[]}
      active
      manualCustomer={false}
      canQuote
      inspectionCredit={0}
    />,
  );
  expect(screen.getByText("Approved")).toBeInTheDocument();
  const depositLabel = screen.getByText("Down payment");
  expect(depositLabel.closest("div")).toHaveTextContent("5,375.00");
  expect(depositLabel.closest("details")).toBeNull();
  expect(screen.getByText("Balance after completion")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Review quotation" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Additional cost (PHP)"),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Create Contract" }));
  expect(screen.getByLabelText("Responsibilities")).toBeInTheDocument();
  expect(screen.queryByLabelText("Additional days")).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Request Extra Work Approval" }),
  );
  expect(screen.getByLabelText("Additional cost (PHP)")).toBeInTheDocument();
});
test("server rejects extra-work fields in a normal contract and binds decisions to versions", () => {
  const doc = {
    kind: "contract",
    title: "Service contract",
    note: "Agreed service responsibilities",
    costDelta: 2000,
    daysDelta: 1,
  };
  expect(parseWorkflowAction("admin_document", doc)).toBeNull();
  expect(
    parseWorkflowAction("admin_document", {
      ...doc,
      costDelta: 0,
      daysDelta: 0,
    }),
  ).not.toBeNull();
  expect(
    parseWorkflowAction("admin_document", { ...doc, kind: "change_order" }),
  ).not.toBeNull();
  expect(parseWorkflowAction("respond_document", { accept: false })).toBeNull();
});
test.each([false, true])(
  "quotation automatically computes the deposit for contract=%s",
  async (contractRequired) => {
    post.mockResolvedValue(null);
    render(
      <QuoteBuilder
        bookingId="booking"
        contractRequired={contractRequired}
        milestones={[]}
        initialQuote={{
          ...quote,
          status: "declined",
          deposit_amount: 0,
          line_items: [
            {
              description: "Aircon cleaning labor",
              quantity: 1,
              unitPrice: 10750,
            },
          ],
        }}
      />,
    );
    expect(
      screen.queryByLabelText(/Required payment before execution/),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Payment terms")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Estimated duration"),
    ).not.toBeInTheDocument();
    const file = new File([], "receipt.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
      value: async () =>
        "description,amount\nAircon cleaning,10750.00\nTOTAL,10750.00",
    });
    fireEvent.change(screen.getByLabelText("Expense receipt (CSV)"), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Review quotation" }),
      ).toBeEnabled(),
    );
    expect(
      screen
        .getByText(
          contractRequired ? "Down payment (50%):" : "Full payment (100%):",
        )
        .closest("p"),
    ).toHaveTextContent(contractRequired ? "5,375.00" : "10,750.00");
    fireEvent.change(screen.getByLabelText(/Quote valid until/), {
      target: { value: "2030-11-10T09:00" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Review quotation" }).closest("form")!,
    );
    expect(post).not.toHaveBeenCalled();
    fireEvent.submit(
      screen.getByRole("button", { name: "Issue quotation" }).closest("form")!,
    );
    expect(post).toHaveBeenCalledWith(
      "/api/workflow/booking",
      expect.objectContaining({
        action: "admin_quote",
        data: expect.objectContaining({ deposit: contractRequired ? 5375 : 0 }),
      }),
    );
  },
);
