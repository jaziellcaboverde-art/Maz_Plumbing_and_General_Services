import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/workflow/load", () => ({ loadManagedBooking: load }));
vi.mock("@/lib/workflow/session", () => ({
  workflowSession: async () => ({
    client: {
      from: (table: string) => {
        const result = {
          data:
            table === "profiles"
              ? { first_name: "Test", last_name: "Customer" }
              : [],
          error: null,
        };
        const query = {
          select: () => query,
          eq: () => query,
          order: () => query,
          limit: () => query,
          maybeSingle: async () => result,
          then: (resolve: (value: typeof result) => unknown) =>
            Promise.resolve(result).then(resolve),
        };
        return query;
      },
    },
  }),
}));
vi.mock("@/components/provider/admin-work-controls", () => ({
  TeamOfferForm: () => <div>Team form</div>,
  MazAppointmentForm: () => <div>Appointment form</div>,
  WorkMilestoneForm: () => <div>Optional checkpoint</div>,
  WorkReviewControls: () => null,
}));
vi.mock("@/components/workflow/action-form", () => ({
  ActionForm: ({ label }: { label: string }) => <button>{label}</button>,
}));
vi.mock("@/components/workflow/quote-builder", () => ({
  QuoteBuilder: () => <button>Prepare quotation</button>,
}));
import { AdminBooking } from "@/components/workflow/admin-booking";

const id = "8408618c-6c09-4583-9c07-47b29372e77a";
const base = {
  error: null,
  booking: {
    id,
    customer_id: id,
    provider_id: null,
    status: "open",
    official_status: "Pending",
    description: "Fix kitchen leak",
    admin_accepted_at: null,
    inspection_required: false,
    contract_required: false,
    quote_total: null,
    gateway_fee: 0,
    scheduled_start: null,
    services: { name: "Plumbing" },
  },
  summary: {
    net_paid: 0,
    inspection_due: 0,
    deposit_due: 0,
    milestone_due: 0,
    balance_due: 0,
    team: [],
  },
  quotes: [],
  documents: [],
  claims: [],
  requests: [],
  milestones: [],
  payments: [],
  receipts: [],
  consent: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  load.mockResolvedValue(base);
});

test("a new request shows the next action without empty payment, work or document sections", async () => {
  render(await AdminBooking({ id }));
  expect(
    screen.getByText("Review Customer Request"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("tab", { name: "Team & schedule" }),
  ).toBeInTheDocument();
  for (const name of [
    "Payments & requests",
    "Work & completion",
    "Assignments and date agreements",
    "Project control",
  ]) {
    expect(screen.queryByRole("tab", { name })).not.toBeInTheDocument();
  }
  await userEvent.click(screen.getByRole("tab", { name: "Activity history" }));
  expect(screen.queryByRole("heading", { name: "Customer request" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "Overview" }));
  expect(screen.getByRole("heading", { name: "Customer request" })).toBeVisible();
});

test("an accepted quote keeps the required contract visible and shows the actual remaining balance", async () => {
  load.mockResolvedValue({
    ...base,
    booking: {
      ...base.booking,
      admin_accepted_at: "2030-01-01T00:00:00Z",
      contract_required: true,
      quote_total: 5000,
    },
    summary: { ...base.summary, net_paid: 1500 },
    quotes: [
      {
        id: "quote",
        version: 1,
        status: "accepted",
        amount: 5000,
        deposit_amount: 1500,
        notes: "Replace sink trap",
        line_items: [],
        payment_schedule: [],
      },
    ],
  });
  render(await AdminBooking({ id }));
  expect(
    screen.getByText("Create Required Contract"),
  ).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("tab", { name: "Quote & approval" }),
  );
  expect(
    screen.getByRole("tab", { name: "Quote & approval" }),
  ).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    screen.getByRole("button", {
      name: "Create Contract",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Remaining balance:/).closest("div"),
  ).toHaveTextContent("3,500.00");
});

test.each([["signed", "Close booking"]])("%s retains its required completion action", async (status, label) => {
  load.mockResolvedValue({
    ...base,
    booking: {
      ...base.booking,
      status,
      admin_accepted_at: "2030-01-01T00:00:00Z",
      scheduled_start: "2030-01-05T01:00:00Z",
    },
  });
  render(await AdminBooking({ id }));
  await userEvent.click(screen.getByRole("tab", { name: "Work & completion" }));
  expect(
    screen.getByRole("heading", { name: "Work & completion" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
});
