import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { CollapsibleWorkspace } from "@/components/layout/collapsible-workspace";
import { SIDEBAR_STORAGE_KEY, sidebarInitScript } from "@/lib/sidebar-preference";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem(SIDEBAR_STORAGE_KEY);
  delete document.documentElement.dataset.sidebarCollapsed;
});

test("saved collapsed layout is applied before hydration and not overwritten on mount", async () => {
  localStorage.setItem(SIDEBAR_STORAGE_KEY, "true");
  new Function(sidebarInitScript())();
  expect(document.documentElement.dataset.sidebarCollapsed).toBe("true");
  render(<StrictMode><CollapsibleWorkspace sidebar={<p>Navigation</p>} footer={<p>Account</p>}><p>Page</p></CollapsibleWorkspace></StrictMode>);
  expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
  expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("true");
  await userEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
  expect(document.documentElement.dataset.sidebarCollapsed).toBe("false");
  expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("false");
});

test("blocked browser storage does not crash initialization or the sidebar control", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
  new Function(sidebarInitScript())();
  expect(document.documentElement.dataset.sidebarCollapsed).toBe("false");
  render(<CollapsibleWorkspace sidebar={<p>Navigation</p>} footer={<p>Account</p>}><p>Page</p></CollapsibleWorkspace>);
  await userEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
  expect(document.documentElement.dataset.sidebarCollapsed).toBe("true");
  expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
});
