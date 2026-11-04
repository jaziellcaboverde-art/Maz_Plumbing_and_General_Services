import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import { ServiceCardLink } from "@/components/services/service-card-link";

vi.mock("@/components/ui/modal", () => ({
  Modal: ({ children, onClose }: { children: ReactNode; onClose: () => void }) =>
    <div role="dialog"><button onClick={onClose}>Close</button>{children}</div>,
}));
vi.mock("@/components/services/service-showcase", () => ({
  ServiceShowcase: ({ service }: { service: { name: string } }) => <p>Portfolio for {service.name}</p>,
}));
afterEach(() => vi.unstubAllGlobals());

test("a service card opens its portfolio and can be closed", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    service: { name: "Drain cleaning" }, photos: [], reviews: [],
  }) });
  vi.stubGlobal("fetch", fetch);
  render(<ServiceCardLink href="/services/drain-cleaning" name="Drain cleaning">View service</ServiceCardLink>);
  fireEvent.click(screen.getByRole("link", { name: "View service" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(await screen.findByText("Portfolio for Drain cleaning")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/api/services/drain-cleaning", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("failed requests provide a direct link to the service", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  render(<ServiceCardLink href="/services/plumbing" name="Plumbing">View plumbing</ServiceCardLink>);
  fireEvent.click(screen.getByRole("link", { name: "View plumbing" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load");
  expect(screen.getByRole("link", { name: "Open service details" })).toHaveAttribute("href", "/services/plumbing");
});
