import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { forwardRef, type ComponentProps } from "react";
import { AutoFilterForm } from "@/components/ui/auto-filter-form";

const navigation = vi.hoisted(() => ({ query: "", submit: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("next/form", () => ({
  default: forwardRef<
    HTMLFormElement,
    ComponentProps<"form"> & { replace?: boolean; scroll?: boolean }
  >(function MockForm({ replace, scroll, onSubmit, ...props }, ref) {
    void replace;
    void scroll;
    return (
      <form
        {...props}
        ref={ref}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.(event);
          navigation.submit(new FormData(event.currentTarget));
        }}
      />
    );
  }),
}));

function Filters() {
  return (
    <AutoFilterForm action="/customer/bookings" label="Booking filters">
      <input name="q" type="search" aria-label="Search" />
      <select name="status" aria-label="Status">
        <option value="">All</option>
        <option>Pending</option>
      </select>
      <input name="from" type="date" aria-label="From" />
    </AutoFilterForm>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  navigation.query = "";
  navigation.submit.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test("search submits once after typing pauses and includes current filters", () => {
  render(<Filters />);
  fireEvent.change(screen.getByLabelText("Search"), {
    target: { value: "Test" },
  });
  act(() => vi.advanceTimersByTime(300));
  fireEvent.change(screen.getByLabelText("Search"), {
    target: { value: "Test Customer" },
  });
  act(() => vi.advanceTimersByTime(399));
  expect(navigation.submit).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(navigation.submit).toHaveBeenCalledTimes(1);
  expect(navigation.submit.mock.calls[0][0].get("q")).toBe("Test Customer");
});

test("selects and dates apply immediately, cancel pending search, and retain its text", () => {
  render(<Filters />);
  fireEvent.change(screen.getByLabelText("Search"), {
    target: { value: "repair" },
  });
  fireEvent.change(screen.getByLabelText("Status"), {
    target: { value: "Pending" },
  });
  expect(navigation.submit).toHaveBeenCalledTimes(1);
  expect(navigation.submit.mock.calls[0][0].get("q")).toBe("repair");
  fireEvent.change(screen.getByLabelText("From"), {
    target: { value: "2026-11-04" },
  });
  expect(navigation.submit).toHaveBeenCalledTimes(2);
  act(() => vi.advanceTimersByTime(500));
  expect(navigation.submit).toHaveBeenCalledTimes(2);
});

test("external clear restores fields, and unmount cancels pending submission", () => {
  navigation.query = "q=repair&status=Pending";
  const view = render(<Filters />);
  expect(screen.getByLabelText("Search")).toHaveValue("repair");
  navigation.query = "";
  view.rerender(<Filters />);
  expect(screen.getByLabelText("Search")).toHaveValue("");
  expect(screen.getByLabelText("Status")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Search"), {
    target: { value: "repair" },
  });
  view.unmount();
  act(() => vi.advanceTimersByTime(500));
  expect(navigation.submit).not.toHaveBeenCalled();
});
