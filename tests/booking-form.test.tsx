import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const insert = vi.fn();
const update = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/location/location-picker", () => ({
  LocationPicker: () => <div>Map</div>,
}));
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    from: () => ({
      insert: (row: unknown) => {
        insert(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: "new-draft" }, error: null }),
          }),
        };
      },
      update: (row: unknown) => {
        update(row);
        return { eq: async () => ({ error: null }) };
      },
    }),
    storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) },
    rpc: vi.fn(),
  }),
}));

import { BookingForm } from "@/app/(customer)/customer/bookings/new/booking-form";
import { valuesFromDraft } from "@/lib/booking/rules";
import { LiveTracker } from "@/components/job/live-tracker";

const services = [
  {
    id: "s1",
    category: "Plumbing",
    name: "Leak Detection & Repair",
    defaultClass: "minor" as const,
    urgentAllowed: false,
    description: "Hidden leaks found and fixed.",
  },
  {
    id: "s2",
    category: "Emergency",
    name: "Emergency Service",
    defaultClass: "minor" as const,
    urgentAllowed: true,
    description: "Call anytime.",
  },
  {
    id: "s3",
    category: "Renovation",
    name: "House & Condominium Renovation",
    defaultClass: "major" as const,
    urgentAllowed: false,
    description: "Full renovations.",
  },
];
const addresses = [
  { id: "a1", label: "Home, 1 Mabini St, Pasig", hasPin: true },
];
const base = {
  customerId: "c1",
  services,
  addresses,
  initialDraftId: null,
  initialPhotos: [] as string[],
};

describe("booking form (Phase 6)", () => {
  test("booking and live tracking prerender without reading the current clock", () => {
    const clock = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Clock accessed during prerender");
    });
    vi.stubGlobal("Date", new Proxy(Date, {
      construct(target, args, newTarget) {
        if (!args.length) throw new Error("Current date accessed during prerender");
        return Reflect.construct(target, args, newTarget);
      },
    }));
    try {
      expect(() => renderToString(<BookingForm {...base} initialValues={valuesFromDraft(null)} />)).not.toThrow();
      expect(() => renderToString(<LiveTracker bookingId="booking" />)).not.toThrow();
      expect(clock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      clock.mockRestore();
    }
  });
  test("the Continue button says why it is disabled until a service is chosen", () => {
    render(<BookingForm {...base} initialValues={valuesFromDraft(null)} />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(
      screen.getByText("Choose a service to continue."),
    ).toBeInTheDocument();
  });

  test("a saved draft resumes with its answers filled in", async () => {
    const user = userEvent.setup();
    const initialValues = valuesFromDraft({
      service_id: "s2",
      description: "Pipe burst in the kitchen",
      address_id: "a1",
      preferred_start: null,
      is_urgent: true,
      is_major_renovation: false,
      terms_accepted_at: null,
    });
    render(
      <BookingForm
        {...base}
        initialDraftId="d1"
        initialValues={initialValues}
      />,
    );
    expect(screen.getByLabelText("Service")).toHaveValue("s2");
    expect(screen.getByLabelText("Describe the job")).toHaveValue(
      "Pipe burst in the kitchen",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText("Service address")).toBeInTheDocument();
  });

  test("the major renovation tick is locked on for a major service (step 6.5)", () => {
    render(
      <BookingForm
        {...base}
        initialValues={valuesFromDraft({
          service_id: "s3",
          description: null,
          address_id: null,
          preferred_start: null,
          is_urgent: false,
          is_major_renovation: false,
          terms_accepted_at: null,
        })}
      />,
    );
    const tick = screen.getByRole("checkbox", { name: /major renovation/i });
    expect(tick).toBeChecked();
    expect(tick).toBeDisabled();
  });

  test("the review step lists exactly what is still missing next to the submit button (step 6.9)", async () => {
    const user = userEvent.setup();
    const initialValues = valuesFromDraft({
      service_id: "s1",
      description: "Sink leaks badly at night",
      address_id: "a1",
      preferred_start: null,
      is_urgent: false,
      is_major_renovation: false,
      terms_accepted_at: null,
    });
    render(
      <BookingForm
        {...base}
        initialDraftId="d1"
        initialValues={initialValues}
      />,
    );
    // Walk to the date step. The date is empty, so Continue stays disabled there.
    for (let i = 0; i < 2; i += 1)
      await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(
      within(document.body).getByText(
        "Choose a date and time in the future, or switch on urgent.",
      ),
    ).toBeInTheDocument();
  });
});
