import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import { AddProviders } from "@/app/(admin)/admin/users/add-providers";
const services = [
  { id: "service1", name: "Leak repair", category: "Plumbing" },
];

test("manual bulk entry previews two providers and generates distinct passwords only on submission", async () => {
  const user = userEvent.setup();
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return Response.json({
        results: body.providers.map((row: { key: string; email: string }) => ({
          key: row.key,
          email: row.email,
          status: "created",
          providerId: "new",
        })),
      });
    });
  render(<AddProviders services={services} />);
  await user.click(screen.getByRole("button", { name: "Add providers" }));
  const dialog = screen.getByRole("dialog", { name: "Add existing providers" });
  await user.click(
    within(dialog).getByRole("button", { name: "Add another provider" }),
  );
  for (const index of [1, 2]) {
    const group = within(dialog).getByRole("group", {
      name: `Provider ${index}`,
    });
    await user.type(
      within(group).getByLabelText("First name", { exact: true }),
      "Juan",
    );
    await user.type(
      within(group).getByLabelText("Last name", { exact: true }),
      "Cruz",
    );
    await user.type(
      within(group).getByLabelText("Email", { exact: true }),
      `juan${index}@example.com`,
    );
    await user.type(
      within(group).getByLabelText("Mobile", { exact: true }),
      "09171234567",
    );
    await user.click(within(group).getByText("Approved services (0 selected)"));
    await user.click(
      within(group).getByRole("checkbox", { name: /Leak repair/ }),
    );
  }
  await user.click(
    within(dialog).getByRole("button", {
      name: "Review providers",
    }),
  );
  expect(fetchMock).not.toHaveBeenCalled();
  await user.click(
    within(dialog).getByRole("button", {
      name: "Add 2 approved providers",
    }),
  );
  await waitFor(() =>
    expect(
      within(dialog).getByRole("button", { name: "Download sign-in details" }),
    ).toBeVisible(),
  );
  const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
  expect(body.providers).toHaveLength(2);
  expect(body.providers[0].password).not.toBe(body.providers[1].password);
  expect(body.providers[0].password.length).toBeGreaterThan(15);
  expect(refresh).toHaveBeenCalledOnce();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
});

test("CSV preview exposes invalid rows before any request and remains in one dialog", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.spyOn(globalThis, "fetch");
  render(<AddProviders services={services} />);
  await user.click(screen.getByRole("button", { name: "Add providers" }));
  await user.click(screen.getByRole("tab", { name: "CSV import" }));
  const csv =
    "first_name,last_name,email,mobile,services\nJuan,Cruz,invalid,09171234567,Leak repair\n";
  const file = new File([csv], "workers.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", { value: async () => csv });
  await user.upload(screen.getByLabelText("Provider CSV file"), file);
  await waitFor(() =>
    expect(screen.getByText(/Enter a valid email/)).toBeVisible(),
  );
  expect(
    screen.getByRole("button", { name: "Add 0 approved providers" }),
  ).toBeDisabled();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
});
