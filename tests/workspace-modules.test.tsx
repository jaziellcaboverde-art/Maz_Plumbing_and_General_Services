import { beforeAll, expect, test, vi } from "vitest";
import { Activity, useEffect } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingWorkspace } from "@/components/workflow/booking-workspace";
import { BookingSection } from "@/components/workflow/booking-section";
import { RouteModal } from "@/components/ui/route-modal";

const back = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ back }) }));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

test("booking tabs preserve draft values and support keyboard navigation", async () => {
  const user = userEvent.setup();
  render(
    <BookingWorkspace>
      <BookingSection title="Review request">
        <label>
          Decision note
          <input />
        </label>
      </BookingSection>
      {false && <BookingSection title="Unavailable">Hidden</BookingSection>}
      <BookingSection title="Team & schedule">Choose a team</BookingSection>
      <BookingSection title="Activity history">Saved decisions</BookingSection>
    </BookingWorkspace>,
  );
  await user.type(screen.getByLabelText("Decision note"), "Keep this draft");
  await user.click(screen.getByRole("tab", { name: "Team & schedule" }));
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Choose a team");
  await user.keyboard("{End}");
  expect(screen.getByRole("tab", { name: "Activity history" })).toHaveFocus();
  await user.keyboard("{Home}");
  expect(screen.getByLabelText("Decision note")).toHaveValue("Keep this draft");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("overview modules open in a dialog and preserve input after reopening", async () => {
  const user = userEvent.setup();
  render(
    <BookingSection title="Requests and support">
      <label>
        Request message
        <input />
      </label>
    </BookingSection>,
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Requests and support" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Requests and support" });
  await user.type(
    within(dialog).getByLabelText("Request message"),
    "Please check",
  );
  await user.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Requests and support" }),
  );
  expect(screen.getByLabelText("Request message")).toHaveValue("Please check");
});

test("closing route details returns to the underlying list", async () => {
  const user = userEvent.setup();
  render(
    <RouteModal title="Booking details">
      <p>Authorized booking content</p>
    </RouteModal>,
  );
  expect(screen.getByRole("dialog").parentElement).toBe(document.body);
  const dialog = screen.getByRole("dialog");
  await user.click(screen.getByRole("button", { name: "Close" }));
  // The router mock never resolves navigation; the backdrop must still release now.
  expect(dialog).not.toHaveAttribute("open");
  fireEvent(dialog, new Event("close"));
  expect(back).toHaveBeenCalledOnce();
});

test("conditional sections grouped in fragments remain available as tabs", async () => {
  const user = userEvent.setup();
  render(
    <BookingWorkspace>
      <BookingSection title="Overview">Request summary</BookingSection>
      <>
        <BookingSection title="Company review">Company rating</BookingSection>
        <BookingSection title="Worker feedback">
          Private feedback
        </BookingSection>
      </>
    </BookingWorkspace>,
  );
  await user.click(screen.getByRole("tab", { name: "Worker feedback" }));
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Private feedback");
  await user.click(screen.getByRole("tab", { name: "Company review" }));
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Company rating");
});

test("preserved route dialogs release their backdrop while hidden and reopen on Forward", async () => {
  const user = userEvent.setup();
  const content = <RouteModal title="Preserved booking">Booking content</RouteModal>;
  const view = render(<Activity mode="visible">{content}</Activity>);
  const dialog = screen.getByRole("dialog");
  view.rerender(<Activity mode="hidden">{content}</Activity>);
  expect(dialog).not.toHaveAttribute("open");
  view.rerender(<Activity mode="visible">{content}</Activity>);
  expect(screen.getByRole("dialog")).toHaveAttribute("open");
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(dialog).not.toHaveAttribute("open");
  view.rerender(<Activity mode="hidden">{content}</Activity>);
  view.rerender(<Activity mode="visible">{content}</Activity>);
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(back).toHaveBeenCalledTimes(2);
});

test("removing an earlier workflow stage keeps the current tab selected", async () => {
  const user = userEvent.setup();
  const view = render(
    <BookingWorkspace>
      <BookingSection title="Review request">Pending</BookingSection>
      <BookingSection title="Quote & approval">Quotation</BookingSection>
    </BookingWorkspace>,
  );
  await user.click(screen.getByRole("tab", { name: "Quote & approval" }));
  view.rerender(
    <BookingWorkspace>
      <BookingSection title="Quote & approval">Quotation</BookingSection>
      <BookingSection title="Activity history">History</BookingSection>
    </BookingWorkspace>,
  );
  expect(screen.getByRole("tab", { name: "Quote & approval" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("secondary modules switch tabs inside one dialog, including deeper modules", async () => {
  const user = userEvent.setup();
  render(
    <RouteModal title="Booking details">
      <p>Booking overview</p>
      <BookingSection title="Requests and support">
        <label>
          Support message
          <input />
        </label>
        <BookingSection title="Request confirmation">
          Confirm this request
        </BookingSection>
      </BookingSection>
    </RouteModal>,
  );
  await user.click(
    screen.getByRole("button", { name: "Requests and support" }),
  );
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(
    screen.getByRole("tab", { name: "Requests and support" }),
  ).toHaveAttribute("aria-selected", "true");
  await user.click(
    screen.getByRole("button", { name: "Request confirmation" }),
  );
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByRole("tabpanel")).toHaveTextContent(
    "Confirm this request",
  );
  await user.click(screen.getByRole("tab", { name: "Requests and support" }));
  expect(screen.getByLabelText("Support message")).toBeVisible();
  await user.click(screen.getByRole("tab", { name: "Overview" }));
  expect(screen.getByText("Booking overview")).toBeVisible();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
});

test("unopened modules and unvisited tabs defer mounting their forms", async () => {
  const mounted = vi.fn();
  function Form({ name }: { name: string }) {
    useEffect(() => {
      mounted(name);
    }, [name]);
    return (
      <label>
        {name}
        <input />
      </label>
    );
  }
  const user = userEvent.setup();
  const view = render(
    <BookingSection title="Optional module">
      <Form name="Optional form" />
    </BookingSection>,
  );
  expect(mounted).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Optional module" }));
  expect(mounted).toHaveBeenCalledTimes(1);
  view.unmount();
  mounted.mockClear();
  render(
    <BookingWorkspace>
      <BookingSection title="First">
        <Form name="First form" />
      </BookingSection>
      <BookingSection title="Second">
        <Form name="Second form" />
      </BookingSection>
    </BookingWorkspace>,
  );
  expect(mounted).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("tab", { name: "Second" }));
  expect(mounted).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole("tab", { name: "First" }));
  expect(mounted).toHaveBeenCalledTimes(2);
});
