import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import {
  CustomersTable,
  type CustomerRow,
} from "@/app/(admin)/admin/customers/customers-table";
import {
  AuditLogScreen,
  type AuditEvent,
} from "@/app/(admin)/admin/audit-log/audit-log-screen";

afterEach(cleanup);
const customers: CustomerRow[] = [
  {
    id: "1",
    name: "Maria Cruz",
    contactName: "",
    accountType: "household",
    email: "maria@example.com",
    mobile: "09171234567",
    projectCount: 1,
    latestService: "Plumbing",
    latestStatus: "in_progress",
    latestStage: "In progress",
    lastActive: "2026-11-04T01:00:00Z",
  },
  {
    id: "2",
    name: "Juan Reyes",
    contactName: "",
    accountType: "household",
    email: "juan@example.com",
    mobile: "09171234568",
    projectCount: 1,
    latestService: "Repair",
    latestStatus: "open",
    latestStage: "Requests",
    lastActive: "2026-11-03T01:00:00Z",
  },
];
test("customer search, date and stage apply together without Filter", () => {
  render(<CustomersTable customers={customers} />);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Maria" },
  });
  expect(screen.getByText("Maria Cruz")).toBeInTheDocument();
  expect(screen.queryByText("Juan Reyes")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Last active on"), {
    target: { value: "2026-11-03" },
  });
  expect(
    screen.getByText("No customers match these filters."),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
  expect(screen.getByText("Juan Reyes")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter by latest project stage"), {
    target: { value: "In progress" },
  });
  expect(screen.queryByText("Juan Reyes")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Filter" }),
  ).not.toBeInTheDocument();
});
test("audit name search, action and date apply together immediately", () => {
  const events: AuditEvent[] = customers.map((customer, index) => ({
    id: customer.id,
    actor: customer.name,
    actorId: customer.id,
    actorRole: "admin",
    action: index ? "provider.admin_created" : "booking.status",
    target: "Booking",
    targetTable: "bookings",
    targetId: "1",
    reason: null,
    details: {},
    createdAt: customer.lastActive,
  }));
  render(<AuditLogScreen events={events} loadError={null} />);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Maria" },
  });
  expect(screen.getByText("Maria Cruz")).toBeInTheDocument();
  expect(screen.queryByText("Juan Reyes")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter by action"), {
    target: { value: "providers" },
  });
  expect(
    screen.getByText("No audit events match these filters."),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
  expect(screen.getByText("Juan Reyes")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter by date"), {
    target: { value: "2026-11-04" },
  });
  expect(
    screen.getByText("No audit events match these filters."),
  ).toBeInTheDocument();
});
