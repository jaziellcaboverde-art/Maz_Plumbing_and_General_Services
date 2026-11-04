import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AutoRefresh } from "@/components/matching/auto-refresh";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  refresh.mockClear();
});
test("does not refresh a hidden tab or interrupt form input", () => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const view = render(
    <div>
      <form>
        <input aria-label="Draft" />
      </form>
      <AutoRefresh />
    </div>,
  );
  screen.getByLabelText("Draft").focus();
  act(() => vi.advanceTimersByTime(30000));
  expect(refresh).not.toHaveBeenCalled();
  fireEvent.blur(screen.getByLabelText("Draft"));
  screen.getByLabelText("Draft").blur();
  act(() => vi.advanceTimersByTime(30000));
  expect(refresh).toHaveBeenCalledTimes(1);
  view.rerender(
    <div hidden>
      <AutoRefresh />
    </div>,
  );
  act(() => vi.advanceTimersByTime(60000));
  expect(refresh).toHaveBeenCalledTimes(1);
});
