import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Button, ButtonGroup } from "@/components/ui/button";

afterEach(cleanup);

describe("Button states", () => {
  test("default: shows the label and calls onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Send request</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("type defaults to button so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  test("focus: reachable by keyboard", async () => {
    render(<Button variant="primary">Pay deposit</Button>);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Pay deposit" })).toHaveFocus();
  });

  test("loading: keeps the label, is busy, blocks clicks, stays focusable", async () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" loading onClick={onClick}>
        Send request
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Send request" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.tab();
    expect(button).toHaveFocus();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  test("disabled: cannot be clicked", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Continue
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Continue" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  test("disabled with a reason: the reason is on screen and linked to the button", () => {
    render(
      <Button id="pay" variant="primary" disabled disabledReason="Choose a payment method first.">
        Pay deposit
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Pay deposit" });
    expect(button).toBeDisabled();
    expect(screen.getByText("Choose a payment method first.")).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-describedby", "pay-reason");
    expect(document.getElementById("pay-reason")).toHaveTextContent("Choose a payment method first.");
  });

  test("a reason is not shown while the button is enabled", () => {
    render(<Button disabledReason="Not shown">Continue</Button>);
    expect(screen.queryByText("Not shown")).not.toBeInTheDocument();
  });
});

describe("ButtonGroup", () => {
  test("keeps the primary button first in the page order", () => {
    render(
      <ButtonGroup>
        <Button variant="primary">Send request</Button>
        <Button>Cancel</Button>
      </ButtonGroup>,
    );
    const names = screen.getAllByRole("button").map((b) => b.textContent);
    expect(names).toEqual(["Send request", "Cancel"]);
  });
});
