import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const { post, refresh } = vi.hoisted(() => ({
  post: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/matching/client", () => ({ postJson: post }));
vi.mock("@/components/matching/auto-refresh", () => ({
  AutoRefresh: () => null,
}));
import { TeamOfferForm } from "@/components/provider/team-offer-form";
import { MazAppointmentForm } from "@/components/provider/admin-work-controls";
import { acceptedTeamLeads, teamOfferSchema } from "@/lib/provider/team";
const booking = "8408618c-6c09-4583-9c07-47b29372e77a",
  one = "8408618c-6c09-4583-9c07-47b29372e77b",
  two = "8408618c-6c09-4583-9c07-47b29372e77c";
const providers = [
  { id: one, label: "Ana Plumber" },
  { id: two, label: "Ben Electrician" },
];
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2030-11-03T13:00:00Z"));
  post.mockResolvedValue(null);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          slots: [
            {
              starts_at: "2030-11-06T01:00:00.000Z",
              ends_at: "2030-11-06T02:00:00.000Z",
            },
          ],
        }),
      }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("assigning a team", () => {
  it("sets a safe recommended deadline in Philippine time and rejects an invalid expiry before sending", async () => {
    const { container } = render(
      <TeamOfferForm
        bookings={[{ id: booking, label: "Repair" }]}
        providers={providers}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Offer deadline/), {
      target: { value: "2030-11-03T22:00" },
    });
    fireEvent.submit(container.querySelector("form")!);
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "24–48 hours from now",
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Use recommended deadline/ }),
    );
    expect(screen.getByLabelText(/Offer deadline/)).toHaveValue(
      "2030-11-05T09:00",
    );
    fireEvent.submit(container.querySelector("form")!);
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Choose an available work schedule",
    );
  });
  it("submits multiple workers with their own roles in one request", async () => {
    const user = userEvent.setup();
    render(
      <TeamOfferForm
        bookings={[{ id: booking, label: "Repair" }]}
        providers={providers}
      />,
    );
    await user.selectOptions(screen.getByLabelText("Worker 1"), one);
    await user.type(
      screen.getByLabelText("Role / trade for worker 1"),
      "Lead plumber",
    );
    await user.click(
      screen.getByRole("button", { name: "Add another worker" }),
    );
    await user.selectOptions(screen.getByLabelText("Worker 2"), two);
    await user.type(
      screen.getByLabelText("Role / trade for worker 2"),
      "Electrician",
    );
    fireEvent.change(screen.getByLabelText(/Offer deadline/), {
      target: { value: "2030-11-05T09:00" },
    });
    await screen.findByLabelText("Available time");
    await user.selectOptions(
      screen.getByLabelText("Available time"),
      "2030-11-06T01:00:00.000Z",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Send assignment offers to 2 workers",
      }),
    );
    expect(post).toHaveBeenCalledWith(
      `/api/admin/bookings/${booking}/team`,
      expect.objectContaining({
        workers: [
          { providerId: one, trade: "Lead plumber" },
          { providerId: two, trade: "Electrician" },
        ],
        startsAt: "2030-11-06T01:00:00.000Z",
        key: expect.any(String),
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });
  it("rejects duplicate workers and reversed periods", () => {
    const payload = {
      workers: [
        { providerId: one, trade: "Plumber" },
        { providerId: one, trade: "Assistant" },
      ],
      phase: "execution",
      startsAt: "2030-11-06T01:00:00Z",
      endsAt: "2030-11-06T09:00:00Z",
      expiresAt: "2030-11-05T01:00:00Z",
      key: booking,
    };
    expect(teamOfferSchema.safeParse(payload).success).toBe(false);
    expect(
      teamOfferSchema.safeParse({
        ...payload,
        workers: [payload.workers[0]],
        endsAt: "2030-11-04T01:00:00Z",
      }).success,
    ).toBe(false);
  });
});
describe("appointment lead selection", () => {
  it("shows why an empty selector cannot be confirmed and lists pending workers", () => {
    render(
      <MazAppointmentForm
        bookingId={booking}
        leads={[]}
        phase="execution"
        waiting={[{ name: "Ana Plumber", status: "offered" }]}
      />,
    );
    expect(
      screen.getByText(/No accepted execution worker/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ana Plumber/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm MAZ appointment" }),
    ).toBeDisabled();
  });
  it("selects the only accepted lead automatically and submits that worker", async () => {
    const user = userEvent.setup();
    render(<MazAppointmentForm bookingId={booking} leads={[providers[0]]} />);
    expect(screen.getByRole("combobox")).toHaveValue(one);
    await user.click(
      screen.getByRole("button", { name: "Confirm MAZ appointment" }),
    );
    expect(post).toHaveBeenCalledWith(
      `/api/admin/bookings/${booking}/appointment`,
      { leadId: one },
    );
  });
  it("includes accepted legacy leads, filters the phase, and excludes pending or inactive workers", () => {
    expect(acceptedTeamLeads([], providers, "inspection", one, [one])).toEqual([
      { id: one, label: "Ana Plumber - accepted lead" },
    ]);
    expect(
      acceptedTeamLeads(
        [
          {
            provider_id: one,
            phase: "inspection",
            status: "accepted",
            trade: "Inspector",
          },
          {
            provider_id: two,
            phase: "execution",
            status: "offered",
            trade: "Electrician",
          },
        ],
        providers,
        "execution",
        null,
        [],
      ),
    ).toEqual([]);
    expect(
      acceptedTeamLeads(
        [
          {
            provider_id: one,
            phase: "execution",
            status: "accepted",
            trade: "Lead",
          },
        ],
        [],
        "execution",
        null,
        [],
      ),
    ).toEqual([]);
  });
});
