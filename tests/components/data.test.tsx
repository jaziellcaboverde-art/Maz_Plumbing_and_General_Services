import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { List } from "@/components/ui/list";
import { Stepper } from "@/components/ui/stepper";

afterEach(cleanup);

type Row = { id: string; name: string; amount: string };
const columns: Column<Row>[] = [
  { key: "name", header: "Customer", render: (r) => r.name },
  { key: "amount", header: "Deposit", render: (r) => r.amount, numeric: true },
];
const rows: Row[] = [
  { id: "1", name: "Ana", amount: "P2,000" },
  { id: "2", name: "Ben", amount: "P15,000" },
];

describe("DataTable states", () => {
  test("default: headers and rows", () => {
    render(<DataTable caption="Bookings" columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    expect(screen.getByRole("table", { name: "Bookings" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Customer", "Deposit"]);
    expect(screen.getByRole("cell", { name: "P15,000" })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  test("the scroll area is a labelled region that the keyboard can reach", async () => {
    render(<DataTable caption="Bookings" columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    const region = screen.getByRole("region", { name: "Bookings" });
    await userEvent.tab();
    expect(region).toHaveFocus();
  });

  test("loading: says so and is busy", () => {
    render(<DataTable caption="Bookings" columns={columns} rows={[]} getRowKey={(r) => r.id} loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
  });

  test("error: says what went wrong", () => {
    render(
      <DataTable caption="Bookings" columns={columns} rows={[]} getRowKey={(r) => r.id} error="Bookings did not load. Refresh the page." />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Bookings did not load. Refresh the page.");
  });

  test("empty: default message, or your own", () => {
    const { rerender } = render(<DataTable caption="Bookings" columns={columns} rows={[]} getRowKey={(r) => r.id} />);
    expect(screen.getByText("Nothing to show yet.")).toBeInTheDocument();
    rerender(
      <DataTable
        caption="Bookings"
        columns={columns}
        rows={[]}
        getRowKey={(r) => r.id}
        empty={<EmptyState title="No bookings yet. Book a service." />}
      />,
    );
    expect(screen.getByText("No bookings yet. Book a service.")).toBeInTheDocument();
  });
});

describe("List states", () => {
  test("default: plain rows have no link or button", () => {
    render(<List label="Payments" items={[{ id: "1", title: "Deposit", description: "Paid 3 Oct", trailing: "P2,000" }]} />);
    const list = screen.getByRole("list", { name: "Payments" });
    expect(within(list).getByText("Deposit")).toBeInTheDocument();
    expect(within(list).getByText("P2,000")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("a row with href is a link", () => {
    render(<List label="Bookings" items={[{ id: "1", title: "Plumbing", href: "/bookings/1" }]} />);
    expect(screen.getByRole("link", { name: /Plumbing/ })).toHaveAttribute("href", "/bookings/1");
  });

  test("a row with onSelect is a button and calls it", async () => {
    const onSelect = vi.fn();
    render(<List label="Providers" items={[{ id: "1", title: "Ana R.", onSelect }]} />);
    await userEvent.click(screen.getByRole("button", { name: /Ana R\./ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test("keyboard: tab reaches a row, enter selects it", async () => {
    const onSelect = vi.fn();
    render(<List label="Providers" items={[{ id: "1", title: "Ana R.", onSelect }]} />);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: /Ana R\./ })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test("disabled row cannot be selected", async () => {
    const onSelect = vi.fn();
    render(<List label="Providers" items={[{ id: "1", title: "Ben T.", onSelect, disabled: true }]} />);
    const row = screen.getByRole("button", { name: /Ben T\./ });
    expect(row).toBeDisabled();
    await userEvent.click(row);
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("loading, error and empty replace the list", () => {
    const { rerender } = render(<List label="Bookings" items={[]} loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    rerender(<List label="Bookings" items={[]} error="Bookings did not load. Refresh the page." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Bookings did not load");
    rerender(<List label="Bookings" items={[]} empty={<EmptyState title="No bookings yet. Book a service." />} />);
    expect(screen.getByText("No bookings yet. Book a service.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

describe("Stepper states", () => {
  const steps = [
    { id: "a", label: "Service" },
    { id: "b", label: "Provider" },
    { id: "c", label: "Pay deposit" },
  ];

  test("marks the current step and says where the person is", () => {
    render(<Stepper steps={steps} current={1} label="Booking progress" />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[1]).toHaveTextContent("Step 2 of 3, Current step: Provider");
  });

  test("completed, current and upcoming steps are described in words", () => {
    render(<Stepper steps={steps} current={1} label="Booking progress" />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Completed");
    expect(items[2]).toHaveTextContent("Not started");
  });

  test("a step that needs fixing says so", () => {
    render(<Stepper steps={[{ id: "a", label: "Service", error: true }, ...steps.slice(1)]} current={1} label="Booking progress" />);
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Needs attention");
  });

  test("the navigation is labelled", () => {
    render(<Stepper steps={steps} current={0} label="Booking progress" />);
    expect(screen.getByRole("navigation", { name: "Booking progress" })).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  test("says what to do and offers the action", async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No bookings yet. Book a service."
        description="Your bookings appear here."
        action={
          <Button variant="primary" onClick={onClick}>
            Book a service
          </Button>
        }
      />,
    );
    expect(screen.getByText("No bookings yet. Book a service.")).toBeInTheDocument();
    expect(screen.getByText("Your bookings appear here.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Book a service" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
