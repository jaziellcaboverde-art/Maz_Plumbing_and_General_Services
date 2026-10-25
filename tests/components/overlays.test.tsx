import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ToastProvider, useToast } from "@/components/ui/toast";

afterEach(cleanup);

describe("Modal states", () => {
  test("closed: nothing is shown", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Cancel booking">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("open: a dialog with its title, body and footer", () => {
    render(
      <Modal open onClose={() => {}} title="Cancel booking" footer={<Button variant="primary">Cancel booking</Button>}>
        <p>You will get a refund of P500.</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Cancel booking" })).toBeInTheDocument();
    expect(screen.getByText("You will get a refund of P500.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel booking" })).toBeInTheDocument();
  });

  test("the Close button calls onClose", async () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Cancel booking" />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a click on the backdrop closes, a click inside does not", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Cancel booking">
        <p>Body</p>
      </Modal>,
    );
    fireEvent.click(screen.getByText("Body"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("error: shows what went wrong", () => {
    render(<Modal open onClose={() => {}} title="Cancel booking" error="The booking could not be cancelled. Try again." />);
    expect(screen.getByRole("alert")).toHaveTextContent("The booking could not be cancelled. Try again.");
  });

  test("loading: the footer button is busy and blocked", async () => {
    const onClick = vi.fn();
    render(
      <Modal
        open
        onClose={() => {}}
        title="Cancel booking"
        footer={
          <Button variant="primary" loading onClick={onClick}>
            Cancel booking
          </Button>
        }
      />,
    );
    const button = screen.getByRole("button", { name: "Cancel booking" });
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  test("closing from the parent hides the dialog", () => {
    const { rerender } = render(<Modal open onClose={() => {}} title="Cancel booking" />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(<Modal open={false} onClose={() => {}} title="Cancel booking" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

function Trigger({ status, durationMs }: { status: "success" | "error" | "warning" | "info"; durationMs?: number | null }) {
  const toast = useToast();
  return (
    <Button onClick={() => toast.show({ status, message: `${status} message`, durationMs })}>Show {status}</Button>
  );
}

describe("Toast states", () => {
  test("success: announced politely", async () => {
    render(
      <ToastProvider>
        <Trigger status="success" />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show success" }));
    expect(screen.getByRole("status")).toHaveTextContent("success message");
  });

  test("error: announced as an alert and stays until dismissed", async () => {
    render(
      <ToastProvider>
        <Trigger status="error" />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show error" }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("error message");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("success closes by itself after its duration", async () => {
    render(
      <ToastProvider>
        <Trigger status="success" durationMs={30} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show success" }));
    expect(screen.getByText("success message")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("success message")).not.toBeInTheDocument());
  });

  test("warning stays until dismissed", async () => {
    render(
      <ToastProvider>
        <Trigger status="warning" />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show warning" }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(screen.getByText("warning message")).toBeInTheDocument();
  });

  test("at most 3 toasts are visible", async () => {
    render(
      <ToastProvider>
        <Trigger status="warning" />
      </ToastProvider>,
    );
    const button = screen.getByRole("button", { name: "Show warning" });
    for (let i = 0; i < 5; i++) await userEvent.click(button);
    expect(screen.getAllByText("warning message")).toHaveLength(3);
  });

  test("useToast outside the provider fails loudly", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Trigger status="success" />)).toThrow("useToast must be used inside ToastProvider");
    spy.mockRestore();
  });
});
