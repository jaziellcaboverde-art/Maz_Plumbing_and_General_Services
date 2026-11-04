import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
const { post, refresh } = vi.hoisted(() => ({
  post: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/matching/client", () => ({ postJson: post }));
vi.mock("@/components/provider/available-schedule-picker", () => ({
  AvailableSchedulePicker: () => (
    <>
      <input type="hidden" name="start" value="2030-11-06T01:00:00.000Z" />
      <input type="hidden" name="end" value="2030-11-06T03:00:00.000Z" />
    </>
  ),
}));
import { TeamOfferForm } from "@/components/provider/team-offer-form";
import { defaultWorkerTrade } from "@/lib/provider/team";
const booking = "8408618c-6c09-4583-9c07-47b29372e77a";
const secondBooking = "8408618c-6c09-4583-9c07-47b29372e77f";
const providers = [
  { id: "8408618c-6c09-4583-9c07-47b29372e771", label: "Ana Plumber" },
  { id: "8408618c-6c09-4583-9c07-47b29372e772", label: "Ben Plumber" },
  { id: "8408618c-6c09-4583-9c07-47b29372e773", label: "Cara Plumber" },
  { id: "8408618c-6c09-4583-9c07-47b29372e774", label: "Dan Electrician" },
];
function response(
  ids = providers.slice(0, 3).map((p) => p.id),
  excluded: string[] = [],
) {
  return Response.json({
    mode: "rule_based",
    note: "Operational ranking",
    eligible_count: ids.length,
    eligible_provider_ids: ids,
    top_three: ids
      .filter((id) => !excluded.includes(id))
      .slice(0, 3)
      .map((provider_id) => ({
        provider_id,
        name: providers.find((p) => p.id === provider_id)!.label,
        distance_km: 1,
      })),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2030-11-03T13:00:00Z"));
  post.mockResolvedValue(null);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (input: string) => {
      const excluded =
        new URL(input, "http://localhost").searchParams
          .get("exclude")
          ?.split(",") ?? [];
      return response(undefined, excluded);
    }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("automatically ranks eligible workers, fills the role, and refreshes suggestions after selection", async () => {
  const user = userEvent.setup();
  render(
    <TeamOfferForm
      bookings={[{ id: booking, label: "Leak repair", category: "Plumbing" }]}
      providers={providers.slice(0, 3)}
    />,
  );
  const choose = await screen.findByRole("button", {
    name: "Select Ana Plumber for worker 1",
  });
  expect(
    screen.queryByRole("button", { name: "Recommend providers" }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Role / trade for worker 1")).toHaveValue(
    "Plumber",
  );
  expect(screen.getByLabelText("Role / trade for worker 1")).toHaveAttribute(
    "readonly",
  );
  expect(
    within(screen.getByLabelText("Worker 1")).queryByRole("option", {
      name: /Dan Electrician/,
    }),
  ).not.toBeInTheDocument();
  expect(choose).toHaveTextContent(/^Select$/);
  await user.click(choose);
  expect(screen.getByLabelText("Worker 1")).toHaveValue(providers[0].id);
  await waitFor(() =>
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining(`exclude=${providers[0].id}`),
      expect.anything(),
    ),
  );
  await screen.findByRole("button", {
    name: "Select Ben Plumber for worker 1",
  });
  expect(
    screen.queryByRole("button", { name: /Select Ana Plumber/ }),
  ).not.toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Add another worker" }));
  await user.click(
    screen.getByRole("button", { name: "Select Ben Plumber for worker 2" }),
  );
  expect(screen.getByLabelText("Worker 2")).toHaveValue(providers[1].id);
  expect(screen.getByLabelText("Role / trade for worker 2")).toHaveValue(
    "Plumber",
  );
  await user.click(
    screen.getByRole("button", { name: "Assign 2 workers" }),
  );
  expect(post).toHaveBeenCalledWith(
    `/api/admin/bookings/${booking}/team`,
    expect.objectContaining({
      workers: [
        { providerId: providers[0].id, trade: "Plumber" },
        { providerId: providers[1].id, trade: "Plumber" },
      ],
    }),
  );
});

test("renovation keeps custom trades and supports choosing specialists outside the base ranking", async () => {
  const user = userEvent.setup();
  render(
    <TeamOfferForm
      bookings={[
        {
          id: booking,
          label: "Kitchen renovation",
          category: "Renovation",
          isRenovation: true,
        },
      ]}
      providers={providers}
    />,
  );
  await screen.findByRole("button", { name: /Select Ana Plumber/ });
  const role = screen.getByLabelText("Role / trade for worker 1");
  expect(role).not.toHaveAttribute("readonly");
  await user.type(role, "Lead electrician");
  await user.selectOptions(screen.getByLabelText("Worker 1"), providers[3].id);
  expect(role).toHaveValue("Lead electrician");
  expect(defaultWorkerTrade("Aircon")).toBe("Air-conditioning technician");
  expect(defaultWorkerTrade("Plumbing", true)).toBeUndefined();
});

test("ignores stale responses and clears worker selection when the booking changes", async () => {
  const user = userEvent.setup();
  let resolveFirst!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    resolveFirst = resolve;
  });
  vi.mocked(fetch).mockImplementation((input) =>
    String(input).includes(booking)
      ? pending
      : Promise.resolve(response([providers[3].id])),
  );
  render(
    <TeamOfferForm
      bookings={[
        { id: booking, label: "Leak repair", category: "Plumbing" },
        { id: secondBooking, label: "Wiring", category: "Electrical" },
      ]}
      providers={providers}
    />,
  );
  await user.selectOptions(screen.getByLabelText("Booking"), booking);
  await user.selectOptions(screen.getByLabelText("Booking"), secondBooking);
  await screen.findByRole("button", { name: /Select Dan Electrician/ });
  await act(async () => {
    resolveFirst(response());
  });
  expect(
    screen.queryByRole("button", { name: /Select Ana Plumber/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Role / trade for worker 1")).toHaveValue(
    "Electrician",
  );
  expect(screen.getByLabelText("Worker 1")).toHaveValue("");
});

test("excludes assigned workers from automatic suggestions and allows retry after a failed request", async () => {
  const user = userEvent.setup();
  vi.mocked(fetch).mockRejectedValueOnce(new Error("Network unavailable"));
  render(
    <TeamOfferForm
      bookings={[{ id: booking, label: "Leak repair", category: "Plumbing" }]}
      providers={providers}
      existingAssignments={[
        {
          provider_id: providers[0].id,
          phase: "inspection",
          status: "accepted",
          trade: "Plumber",
        },
      ]}
    />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Network unavailable",
  );
  await user.click(
    screen.getByRole("button", { name: "Retry recommendations" }),
  );
  await screen.findByRole("button", { name: /Select Ben Plumber/ });
  expect(
    screen.queryByRole("button", { name: /Select Ana Plumber/ }),
  ).not.toBeInTheDocument();
});

test("allows replacing historical offers and cancels only unsent selections", async () => {
  const user = userEvent.setup();
  render(
    <TeamOfferForm
      bookings={[{ id: booking, label: "Leak repair", category: "Plumbing" }]}
      providers={providers}
      existingAssignments={[
        {
          provider_id: providers[0].id,
          phase: "inspection",
          status: "offered",
          trade: "Plumber",
        },
      ]}
    />,
  );
  expect(screen.queryByText("Offer pending")).not.toBeInTheDocument();
  expect(screen.queryByText("Awaiting provider acceptance")).not.toBeInTheDocument();
  await user.click(
    await screen.findByRole("button", { name: /Select Ben Plumber/ }),
  );
  expect(screen.getByText(/Worker 1 selection updated/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Cancel changes" }));
  expect(screen.getByLabelText("Worker 1")).toHaveValue("");
  expect(screen.queryByText("Offer pending")).not.toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
});
