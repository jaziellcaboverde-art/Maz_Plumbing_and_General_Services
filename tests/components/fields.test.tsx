import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";

afterEach(cleanup);

describe("Input states", () => {
  test("default: label is connected, typing works", async () => {
    render(<Input label="Mobile number" />);
    const input = screen.getByLabelText("Mobile number");
    await userEvent.type(input, "0917");
    expect(input).toHaveValue("0917");
  });

  test("hint is read with the field", () => {
    render(<Input label="Mobile number" hint="We text a code to this number." />);
    const input = screen.getByLabelText("Mobile number");
    expect(input).toHaveAccessibleDescription("We text a code to this number.");
  });

  test("error: marked invalid and the message says what to fix", () => {
    render(<Input label="Mobile number" status="error" message="Enter 11 digits, starting with 09." />);
    const input = screen.getByLabelText("Mobile number");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter 11 digits, starting with 09.");
    expect(input).toHaveAccessibleDescription(/Enter 11 digits/);
  });

  test("success: shows the message, not invalid", () => {
    render(<Input label="Mobile number" status="success" message="Number verified." />);
    expect(screen.getByLabelText("Mobile number")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("status")).toHaveTextContent("Number verified.");
  });

  test("loading: busy with a text message", () => {
    render(<Input label="Mobile number" status="loading" message="Checking number" />);
    expect(screen.getByLabelText("Mobile number")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Checking number");
  });

  test("disabled: cannot be typed in", async () => {
    render(<Input label="Mobile number" disabled />);
    const input = screen.getByLabelText("Mobile number");
    expect(input).toBeDisabled();
    await userEvent.type(input, "1");
    expect(input).toHaveValue("");
  });
});

describe("Select states", () => {
  const options = (
    <>
      <option value="">Choose a service</option>
      <option value="plumbing">Plumbing</option>
      <option value="electrical">Electrical</option>
    </>
  );

  test("default: choosing an option changes the value", async () => {
    render(<Select label="Service">{options}</Select>);
    const select = screen.getByLabelText("Service");
    await userEvent.selectOptions(select, "electrical");
    expect(select).toHaveValue("electrical");
  });

  test("error: marked invalid with a message", () => {
    render(
      <Select label="Service" status="error" message="Choose a service to continue.">
        {options}
      </Select>,
    );
    expect(screen.getByLabelText("Service")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a service to continue.");
  });

  test("disabled", () => {
    render(
      <Select label="Service" disabled>
        {options}
      </Select>,
    );
    expect(screen.getByLabelText("Service")).toBeDisabled();
  });
});

describe("Checkbox states", () => {
  test("default: toggles on and off", async () => {
    render(<Checkbox label="I agree to the Terms" />);
    const box = screen.getByRole("checkbox", { name: "I agree to the Terms" });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(box).not.toBeChecked();
  });

  test("clicking the label toggles it", async () => {
    render(<Checkbox label="I agree to the Terms" />);
    await userEvent.click(screen.getByText("I agree to the Terms"));
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  test("keyboard: space toggles", async () => {
    render(<Checkbox label="I agree to the Terms" />);
    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  test("error: marked invalid with a message", () => {
    render(<Checkbox label="I agree to the Terms" error="Agree to the Terms to create an account." />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Agree to the Terms to create an account.");
  });

  test("disabled", async () => {
    render(<Checkbox label="I agree to the Terms" disabled />);
    const box = screen.getByRole("checkbox");
    expect(box).toBeDisabled();
    await userEvent.click(box);
    expect(box).not.toBeChecked();
  });
});

describe("RadioGroup states", () => {
  const options = [
    { value: "gcash", label: "GCash" },
    { value: "card", label: "Card", hint: "Visa or Mastercard" },
    { value: "bank", label: "Bank transfer", disabled: true },
  ];

  function Controlled({ error }: { error?: string }) {
    const [value, setValue] = useState<string | null>(null);
    return <RadioGroup legend="Payment method" name="pay" options={options} value={value} onChange={setValue} error={error} />;
  }

  test("default: group has a legend and nothing selected", () => {
    render(<Controlled />);
    expect(screen.getByRole("group", { name: "Payment method" })).toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
  });

  test("choosing an option selects only that one", async () => {
    render(<Controlled />);
    await userEvent.click(screen.getByRole("radio", { name: /GCash/ }));
    expect(screen.getByRole("radio", { name: /GCash/ })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: /Card/ }));
    expect(screen.getByRole("radio", { name: /Card/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /GCash/ })).not.toBeChecked();
  });

  test("calls onChange with the value", async () => {
    const onChange = vi.fn();
    render(<RadioGroup legend="Payment method" name="pay" options={options} value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: /GCash/ }));
    expect(onChange).toHaveBeenCalledWith("gcash");
  });

  test("a disabled option cannot be chosen", async () => {
    const onChange = vi.fn();
    render(<RadioGroup legend="Payment method" name="pay" options={options} value={null} onChange={onChange} />);
    const bank = screen.getByRole("radio", { name: /Bank transfer/ });
    expect(bank).toBeDisabled();
    await userEvent.click(bank);
    expect(onChange).not.toHaveBeenCalled();
  });

  test("hint is read with the option", () => {
    render(<Controlled />);
    expect(screen.getByRole("radio", { name: /Card/ })).toHaveAccessibleDescription("Visa or Mastercard");
  });

  test("error: message is announced and linked to the group", () => {
    render(<Controlled error="Choose a payment method." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a payment method.");
    expect(screen.getByRole("group", { name: "Payment method" })).toHaveAccessibleDescription(/Choose a payment method/);
  });

  test("whole group disabled", () => {
    render(<RadioGroup legend="Payment method" name="pay" options={options} value={null} onChange={() => {}} disabled />);
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
  });
});
