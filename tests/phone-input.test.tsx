import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhoneInput } from "@/components/ui/phone-input";

describe("PhoneInput", () => {
  test("shows +63 before the box and no format hint", () => {
    const { container } = render(<PhoneInput label="Mobile number" name="mobile" />);
    expect(screen.getByText("+63")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/639XXXXXXXXX/);
  });

  test("the form gets the full +639 number", async () => {
    const { container } = render(<form><PhoneInput label="Mobile number" name="mobile" /></form>);
    await userEvent.type(screen.getByLabelText("Mobile number"), "9171234567");
    expect((container.querySelector('input[name="mobile"]') as HTMLInputElement).value).toBe("+639171234567");
  });

  test("a saved number loads without its +63 and a pasted +63 is dropped", async () => {
    render(<PhoneInput label="Mobile number" name="mobile" defaultValue="+639171234567" />);
    const box = screen.getByLabelText("Mobile number");
    expect(box).toHaveValue("9171234567");
    await userEvent.clear(box);
    await userEvent.click(box);
    await userEvent.paste("+63 917 765 4321");
    expect(box).toHaveValue("9177654321");
  });
});
