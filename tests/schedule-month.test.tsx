import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { ScheduleMonth } from "@/components/layout/schedule-month";

describe("provider month schedule", () => {
  test("places work on its Philippine date and preserves its assignment link", async () => {
    const user = userEvent.setup();
    render(<ScheduleMonth today="2026-11-04" events={[{ id: "team-1", start: "2026-11-04T23:00:00Z", label: "Plumbing assignment", href: "/provider/jobs/booking-1" }]} />);
    const assignment = screen.getByRole("link", { name: /Plumbing assignment/ });
    expect(assignment).toHaveAttribute("href", "/provider/jobs/booking-1");
    expect(assignment.parentElement?.querySelector("time")).toHaveAttribute("dateTime", "2026-11-05");
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("heading", { name: "December 2026" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Plumbing assignment/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "This month" }));
    expect(screen.getByRole("link", { name: /Plumbing assignment/ })).toBeInTheDocument();
  });
});
