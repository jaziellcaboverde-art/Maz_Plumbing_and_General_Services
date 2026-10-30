import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

const { createClientMock, searchParamsMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  searchParamsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({ createClient: createClientMock }));
vi.mock("next/navigation", () => ({ useSearchParams: searchParamsMock }));

import { ExpiredLinkRecovery } from "@/app/(public)/link-expired/expired-link-recovery";

afterEach(() => {
  cleanup();
  createClientMock.mockReset();
  searchParamsMock.mockReset();
});

describe("expired signup links", () => {
  test("resends a provider signup confirmation to provider onboarding", async () => {
    const resend = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockReturnValue({ auth: { resend } });
    searchParamsMock.mockReturnValue(new URLSearchParams("next=%2Fprovider-application%2Fsubmit"));

    render(<ExpiredLinkRecovery />);
    await userEvent.type(screen.getByLabelText("Email"), "provider@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Resend confirmation email" }));

    expect(resend).toHaveBeenCalledWith({
      type: "signup",
      email: "provider@example.com",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/confirm?next=%2Fauth%2Fcontinue%3Fintent%3Dprovider",
      },
    });
    expect(await screen.findByText(/use only the newest email/i)).toBeInTheDocument();
  });

  test("resends a customer signup confirmation to customer setup", async () => {
    const resend = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockReturnValue({ auth: { resend } });
    searchParamsMock.mockReturnValue(new URLSearchParams("next=%2Fcustomer%2Fsetup"));

    render(<ExpiredLinkRecovery />);
    await userEvent.type(screen.getByLabelText("Email"), "customer@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Resend confirmation email" }));

    expect(resend).toHaveBeenCalledWith({
      type: "signup",
      email: "customer@example.com",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/confirm?next=%2Fcustomer%2Fsetup",
      },
    });
  });

  test("keeps password recovery links on the reset flow", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockReturnValue({ auth: { resetPasswordForEmail } });
    searchParamsMock.mockReturnValue(new URLSearchParams());

    render(<ExpiredLinkRecovery />);
    await userEvent.type(screen.getByLabelText("Email"), "person@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send a new reset link" }));

    expect(resetPasswordForEmail).toHaveBeenCalledWith("person@example.com", {
      redirectTo: "http://localhost:3000/auth/confirm?next=/reset-password",
    });
  });
});
