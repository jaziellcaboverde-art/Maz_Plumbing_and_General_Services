import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AvailableSchedulePicker } from "@/components/provider/available-schedule-picker";
const booking = "8408618c-6c09-4583-9c07-47b29372e77a";
const one = "8408618c-6c09-4583-9c07-47b29372e77b";
const two = "8408618c-6c09-4583-9c07-47b29372e77c";
const slot = {
  starts_at: "2030-11-06T01:00:00Z",
  ends_at: "2030-11-06T02:00:00Z",
};
afterEach(() => vi.unstubAllGlobals());

test("only returned slots are selectable and changing a worker immediately clears stale schedules", async () => {
  let finish!: (value: unknown) => void;
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ slots: [slot] }) })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  vi.stubGlobal("fetch", fetcher);
  const props = { bookingId: booking, expiry: "2030-11-05T09:00", buffer: 30 };
  const { container, rerender } = render(
    <AvailableSchedulePicker {...props} providerIds={[one]} />,
  );
  fireEvent.change(await screen.findByLabelText("Available time"), {
    target: { value: slot.starts_at },
  });
  expect(container.querySelector('input[name="start"]')).toHaveValue(
    slot.starts_at,
  );
  expect(
    screen.getByLabelText("Available time").querySelectorAll("option"),
  ).toHaveLength(2);
  rerender(<AvailableSchedulePicker {...props} providerIds={[two]} />);
  expect(container.querySelector('input[name="start"]')).toHaveValue("");
  expect(screen.queryByLabelText("Available time")).not.toBeInTheDocument();
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  finish({ ok: true, json: async () => ({ slots: [] }) });
  expect(await screen.findByText(/No available schedule/)).toBeInTheDocument();
  expect(screen.queryByLabelText("Available date")).not.toBeInTheDocument();
});

test("searches the whole team and rechecks availability when duration changes", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ slots: [] }) });
  vi.stubGlobal("fetch", fetcher);
  render(
    <AvailableSchedulePicker
      bookingId={booking}
      providerIds={[one, two]}
      expiry="2030-11-05T09:00"
      buffer={45}
    />,
  );
  await screen.findByText(/No available schedule/);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
    providerIds: [one, two],
    buffer: 45,
    duration: 60,
    after: "2030-11-05T01:00:00.000Z",
  });
  fireEvent.change(screen.getByLabelText("Work duration"), {
    target: { value: "120" },
  });
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetcher.mock.calls[1][1].body).duration).toBe(120);
});

test("does not search until workers and the deadline are selected", () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(
    <AvailableSchedulePicker
      bookingId={booking}
      providerIds={[""]}
      expiry=""
      buffer={30}
    />,
  );
  expect(fetcher).not.toHaveBeenCalled();
  expect(screen.getByText(/Select all workers/)).toBeInTheDocument();
});
