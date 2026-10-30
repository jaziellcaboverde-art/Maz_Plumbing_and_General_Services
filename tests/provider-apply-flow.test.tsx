import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/components/location/location-picker", () => ({ LocationPicker: () => <div>Location picker</div> }));
vi.mock("@/components/auth/google-button", () => ({ GoogleButton: ({ label }: { label: string }) => <button type="button">{label}</button> }));
vi.mock("@/lib/supabase/browser", () => ({ createClient: () => ({}) }));

import { ProviderApplyFlow } from "@/app/(public)/apply/provider/apply-flow";
import { ApplicationSubmitted } from "@/app/(public)/apply/provider/application-submitted";

afterEach(cleanup);

const services = [{ id: "11111111-2222-3333-4444-555555555555", category: "Plumbing", name: "Leak repair" }];

describe("one-page provider application", () => {
  test("the button says Apply and the whole application is on the page", () => {
    render(<ProviderApplyFlow services={services} />);
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create account" })).not.toBeInTheDocument();
    for (const label of ["First name", "Email", "Password", "Expected daily rate (PHP)", "Reference 1 name"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("region", { name: "Provider hiring requirements" })).toBeInTheDocument();
  });

  test("Apply stays disabled and names what is missing until the required documents are uploaded", () => {
    render(<ProviderApplyFlow services={services} />);
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByText(/Upload the required documents first: Government ID, Selfie holding your ID, NBI clearance/)).toBeInTheDocument();
    expect(screen.getByText("0 of 4 required documents uploaded")).toBeInTheDocument();
  });

  test("the Upload documents button opens the popup, and Apply unlocks after all four uploads", async () => {
    render(<ProviderApplyFlow services={services} />);
    await userEvent.click(screen.getByRole("button", { name: "Upload documents" }));
    const dialog = screen.getByRole("dialog", { name: "Upload your documents" });
    for (const label of ["Government ID", "Selfie holding your ID", "NBI clearance", "Barangay clearance or proof of address"]) {
      const input = within(dialog).getByText(label).closest("li")!.querySelector("input[type=file]") as HTMLInputElement;
      await userEvent.upload(input, new File(["x"], `${label}.png`, { type: "image/png" }));
    }
    await userEvent.click(within(dialog).getByRole("button", { name: "Save documents" }));
    expect(screen.getByText("All required documents uploaded (4 files)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
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
