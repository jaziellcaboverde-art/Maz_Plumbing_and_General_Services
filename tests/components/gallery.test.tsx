import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { ComponentGallery } from "../../src/app/dev/components/gallery";

afterEach(cleanup);

describe("component gallery (/dev/components)", () => {
  test("renders every section", () => {
    render(<ComponentGallery />);
    for (const name of ["Buttons", "Inputs", "Checkbox and radio", "Modal and toast", "Table", "List", "Stepper", "File upload"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  test("the modal opens and closes from the page", async () => {
    render(<ComponentGallery />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel this booking?" });
    expect(dialog).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("a toast shows up when its button is pressed", async () => {
    render(<ComponentGallery />);
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(screen.getByText("Request sent")).toBeInTheDocument();
  });

  test("the stepper moves with Next step and Back", async () => {
    render(<ComponentGallery />);
    const stepper = screen.getAllByRole("navigation", { name: "Booking progress" })[0];
    expect(stepper.querySelector('[aria-current="step"]')).toHaveTextContent("Provider");
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(stepper.querySelector('[aria-current="step"]')).toHaveTextContent("Details");
  });
});
