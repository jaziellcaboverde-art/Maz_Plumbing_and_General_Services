import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

const back = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back }) }));
vi.mock("next/link", () => ({
  default: ({ children, href, onClick, className }: { children: React.ReactNode; href: string; onClick?: React.MouseEventHandler<HTMLAnchorElement>; className?: string }) => (
    <a href={href} onClick={onClick} className={className}>{children}</a>
  ),
}));

import { BackLink } from "@/components/ui/back-link";

afterEach(() => { back.mockClear(); vi.restoreAllMocks(); });

describe("BackLink", () => {
  test("goes back when the person came from another page", async () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(3);
    render(<BackLink fallbackHref="/signup" label="Back to sign up" />);
    await userEvent.setup().click(screen.getByRole("link", { name: /back to sign up/i }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  test("is a normal link to the fallback when the page was opened in a new tab", async () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(1);
    render(<BackLink fallbackHref="/signup" label="Back to sign up" />);
    const link = screen.getByRole("link", { name: /back to sign up/i });
    expect(link).toHaveAttribute("href", "/signup");
    await userEvent.setup().click(link);
    expect(back).not.toHaveBeenCalled();
  });
});
