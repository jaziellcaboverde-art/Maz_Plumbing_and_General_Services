import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ReportsDashboard, type ReportsData } from "@/app/(admin)/admin/reports/reports-dashboard";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const data: ReportsData = {
  period: "30",
  rangeLabel: "Oct 6, 2026 – Nov 4, 2026",
  summary: {
    totalBookings: 12,
    completedBookings: 5,
    inProgressBookings: 2,
    urgentBookings: 3,
  },
  payments: {
    collected: 12000,
    refunded: 500,
    outstanding: 2400,
    pendingCount: 2,
  },
  trend: [{ label: "Nov 4", count: 2 }],
  statuses: [{ status: "Completed", count: 5 }],
  providers: [{ name: "Alex Rivera", bookings: 4, averageRating: 4.5, reviewCount: 2 }],
  services: [{ name: "Pipe repair", category: "Plumbing", bookings: 6 }],
};

describe("admin reports dashboard", () => {
  beforeEach(() => push.mockClear());

  test("shows the requested report sections and exports the selected period", () => {
    render(<ReportsDashboard data={data} loadErrors={[]} />);

    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Booking volume" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Booking status" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Popular services" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Provider workload & ratings" })).toBeInTheDocument();
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
  });

  test("changes the report period through the URL", () => {
    render(<ReportsDashboard data={data} loadErrors={[]} />);
    fireEvent.change(screen.getByLabelText("Report date range"), { target: { value: "90" } });
    expect(push).toHaveBeenCalledWith("/admin/reports?period=90");
  });
});
