import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/components/location/location-picker", () => ({
  LocationPicker: ({ onSaved }: { onSaved?: (point: { latitude: number; longitude: number }, address?: string) => void }) => (
    <button type="button" onClick={() => onSaved?.({ latitude: 14.57, longitude: 121.06 }, "Kapitolyo, Pasig")}>Use this location</button>
  ),
}));
vi.mock("@/components/auth/google-button", () => ({ GoogleButton: ({ label }: { label: string }) => <button type="button">{label}</button> }));
vi.mock("@/lib/supabase/browser", () => ({ createClient: () => ({}) }));

import { ProviderApplyFlow } from "@/app/(public)/apply/provider/apply-flow";
import { ApplicationSubmitted } from "@/app/(public)/apply/provider/application-submitted";

afterEach(cleanup);

const services = [{ id: "11111111-2222-3333-4444-555555555555", category: "Plumbing", name: "Leak repair" }];

describe("step-by-step provider application", () => {
  test("starts on step 1 with Continue only: no Back button and no Create account yet", () => {
    render(<ProviderApplyFlow services={services} />);
    expect(screen.getByRole("heading", { name: "Set up your account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create account" })).not.toBeInTheDocument();
    expect(screen.getByText("Upload documents", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Skills setup", { selector: "span" })).toBeInTheDocument();
  });

  test("Continue stays disabled and says what is missing until step 1 is filled in", () => {
    render(<ProviderApplyFlow services={services} />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.getByText(/Fill in every required field to continue/)).toBeInTheDocument();
  });

  test("every field of the application is still on the page for the final submit", () => {
    render(<ProviderApplyFlow services={services} />);
    for (const label of ["First name", "Email", "Password", "Expected daily rate (PHP)", "Reference 1 name"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});

describe("walking through the steps", () => {
  test("Continue unlocks per step, Back appears on step 2, and step 3 ends with Create account", async () => {
    render(<ProviderApplyFlow services={services} />);
    await userEvent.type(screen.getByLabelText("First name"), "Jayco");
    await userEvent.type(screen.getByLabelText("Last name"), "Smith");
    await userEvent.type(screen.getByLabelText("Date of birth"), "1998-10-11");
    await userEvent.type(screen.getByLabelText("Mobile number"), "9913275436");
    await userEvent.type(screen.getByLabelText("Email"), "jayco@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password12345");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();

    // Second screen of step 1: the location. Back goes to the details, Continue needs an area and a base location.
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Choose my location" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: "Pasig" }));
    await userEvent.click(screen.getByRole("button", { name: "Use this location" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Upload documents" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Upload documents" }));
    const dialog = screen.getByRole("dialog", { name: "Upload your documents" });
    for (const label of ["Government ID", "Selfie holding your ID", "NBI clearance", "Barangay clearance or proof of address"]) {
      const input = within(dialog).getByText(label).closest("li")!.querySelector("input[type=file]") as HTMLInputElement;
      await userEvent.upload(input, new File(["x"], `${label}.png`, { type: "image/png" }));
    }
    await userEvent.click(within(dialog).getByRole("button", { name: "Save documents" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Skills setup" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Upload documents" })).toBeInTheDocument();
  });
});

describe("thank you card", () => {
  test("shows the summary, what happens next and a way back home", () => {
    render(<ApplicationSubmitted summary={{
      reference: "MAZ-ABCD1234", name: "Juan Cruz", email: "juan@example.com", mobile: "+639171234567",
      areas: ["Pasig", "Makati"], services: ["Leak repair"], documents: ["Government ID", "NBI clearance"],
    }} />);
    expect(screen.getByRole("heading", { name: "Thank you for applying" })).toBeInTheDocument();
    expect(screen.queryByText(/booked in/i)).not.toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Application summary" });
    expect(within(summary).getByText("MAZ-ABCD1234")).toBeInTheDocument();
    expect(within(summary).getByText("Pasig, Makati")).toBeInTheDocument();
    expect(within(summary).getByText("NBI clearance")).toBeInTheDocument();
    expect(within(summary).getByText(/What happens next/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home page" })).toHaveAttribute("href", "/");
  });
});
