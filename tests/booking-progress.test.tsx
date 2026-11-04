import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { BookingProgress } from "@/components/booking/booking-progress";

afterEach(cleanup);
test.each(["Pending", "Accepted", "Assigned", "Ongoing", "Completed"])(
  "%s marks all reached stages and only one current stage",
  (status) => {
    render(<BookingProgress status={status} />);
    const steps = within(screen.getByRole("list", { name: "Booking progress" })).getAllByRole("listitem");
    const current = ["Pending", "Accepted", "Assigned", "Ongoing", "Completed"].indexOf(status);
    steps.forEach((step, index) => {
      expect(step).toHaveAttribute("data-reached", String(index <= current));
      if (index === current) expect(step).toHaveAttribute("aria-current", "step");
      else expect(step).not.toHaveAttribute("aria-current");
    });
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  },
);
test("cancelled bookings do not imply completed stages", () => {
  render(<BookingProgress status="Cancelled" />);
  screen.getAllByRole("listitem").forEach((step) => {
    expect(step).toHaveAttribute("data-reached", "false");
    expect(step).not.toHaveAttribute("aria-current");
  });
});
