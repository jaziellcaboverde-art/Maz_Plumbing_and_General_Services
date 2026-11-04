import { act, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { postJson } from "@/lib/matching/client";
import { notifySuccess } from "@/lib/ui-feedback";

test("a successful mutation shows confirmation but a rejected mutation does not", async () => {
  render(<ToastProvider>{null}</ToastProvider>);
  const fetchMock = vi.spyOn(globalThis, "fetch");
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
  await act(async () => {
    expect(await postJson("/api/workflow/example", {})).toBeNull();
  });
  expect(screen.getByRole("status")).toHaveTextContent(
    "Changes saved successfully.",
  );
  fetchMock.mockResolvedValueOnce(
    Response.json({ error: "Not approved" }, { status: 409 }),
  );
  await act(async () => {
    expect(await postJson("/api/workflow/example", {})).toBe("Not approved");
  });
  expect(screen.getAllByRole("status")).toHaveLength(1);
});

test("a specific confirmation replaces the generic acknowledgement", () => {
  render(<ToastProvider>{null}</ToastProvider>);
  act(() => {
    notifySuccess();
    notifySuccess("Weekly hours saved.");
  });
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.getByRole("status")).toHaveTextContent("Weekly hours saved.");
});

test("confirmations are available inside a modal without opening another dialog", () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  render(
    <ToastProvider>
      <Modal open onClose={() => {}} title="Settings">
        Form
      </Modal>
    </ToastProvider>,
  );
  act(() => notifySuccess("Settings saved."));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(
    within(screen.getByRole("dialog")).getByRole("status"),
  ).toHaveTextContent("Settings saved.");
});
