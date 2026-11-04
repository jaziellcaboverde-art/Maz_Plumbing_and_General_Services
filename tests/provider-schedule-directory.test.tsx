import { StrictMode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import {
  ProviderScheduleDirectory,
  type DirectoryProvider,
  type DirectoryService,
} from "@/app/(admin)/admin/provider-schedules/provider-schedule-directory";

const plumbing: DirectoryService = { id: "plumbing", name: "Pipe repair", category: "Plumbing" };
const electrical: DirectoryService = { id: "electrical", name: "Wiring", category: "Electrical" };

const providers: DirectoryProvider[] = [
  {
    id: "provider-1",
    name: "Alex Rivera",
    services: [plumbing],
    bookings: [
      {
        id: "booking-active",
        service: "Pipe repair",
        customer: "Jamie Cruz",
        area: "Makati",
        description: "Repair a leaking pipe under the sink.",
        urgent: false,
        startsAt: null,
        status: "in_progress",
      },
      {
        id: "booking-upcoming",
        service: "Pipe repair",
        customer: "Sam Lee",
        area: "Pasig",
        description: null,
        urgent: true,
        startsAt: "2026-11-06T01:00:00.000Z",
        status: "scheduled",
      },
    ],
  },
  { id: "provider-2", name: "Taylor Santos", services: [electrical], bookings: [] },
];

describe("provider schedule directory", () => {
  test("filters by service and opens a provider's active and upcoming booking details", async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <ProviderScheduleDirectory
          providers={providers}
          services={[plumbing, electrical]}
        />
      </StrictMode>,
    );

    await user.selectOptions(screen.getByLabelText("Service"), "plumbing");
    expect(screen.getByRole("button", { name: /view schedule for alex rivera/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /view schedule for taylor santos/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /view schedule for alex rivera/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Alex Rivera" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "In progress now" })).toBeInTheDocument();
    expect(within(dialog).getByText("Jamie Cruz")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Upcoming bookings" })).toBeInTheDocument();
    expect(within(dialog).getByText("Sam Lee")).toBeInTheDocument();
    expect(within(dialog).getByText("Urgent booking")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Close schedule" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("paginates providers and returns to the first page when searching", async () => {
    const user = userEvent.setup();
    const manyProviders = Array.from({ length: 10 }, (_, index) => ({
      id: `provider-${index + 1}`,
      name: `Provider ${String(index + 1).padStart(2, "0")}`,
      services: [],
      bookings: [],
    }));

    render(
      <ProviderScheduleDirectory
        providers={manyProviders}
        services={[]}
      />,
    );

    expect(screen.getByText("Showing 1–9 of 10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view schedule for provider 09/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /view schedule for provider 10/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Showing 10–10 of 10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view schedule for provider 10/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();

    await user.type(screen.getByRole("searchbox"), "Provider 01");
    expect(screen.getByText("1 of 10 providers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view schedule for provider 01/i })).toBeInTheDocument();
  });
});
