import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const { upload, refresh } = vi.hoisted(() => ({
  upload: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "worker" } } }) },
    storage: { from: () => ({ upload }) },
  }),
}));
import { WorkUpdateForm } from "@/components/provider/work-update-form";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test("a failed submission locks its evidence and retries without another upload or record key", async () => {
  upload.mockResolvedValue({ error: null });
  const send = vi
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Please retry." }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", send);
  render(
    <WorkUpdateForm
      bookingId="booking"
      inProgress
      milestones={[{ id: "milestone", title: "Pipe test" }]}
    />,
  );
  fireEvent.change(screen.getByLabelText("Update type"), {
    target: { value: "milestone" },
  });
  fireEvent.change(screen.getByLabelText("Milestone"), {
    target: { value: "milestone" },
  });
  fireEvent.change(screen.getByLabelText("Findings / work notes"), {
    target: { value: "Pressure test completed successfully." },
  });
  fireEvent.change(screen.getByLabelText(/Evidence photos/), {
    target: {
      files: [new File(["photo"], "proof.jpg", { type: "image/jpeg" })],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit to MAZ" }));
  await screen.findByText("Please retry.");
  for (const label of ["Update type", "Milestone", "Findings / work notes"])
    expect(screen.getByLabelText(label)).toBeDisabled();
  expect(screen.getByLabelText(/Evidence photos/)).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Submit to MAZ" }));
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(upload).toHaveBeenCalledOnce();
  expect(send.mock.calls[0][1].body).toBe(send.mock.calls[1][1].body);
  expect(screen.getByLabelText("Milestone")).toBeEnabled();
});
