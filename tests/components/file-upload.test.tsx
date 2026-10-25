import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FileUpload, matchesAccept } from "@/components/ui/file-upload";

afterEach(cleanup);

const FIVE_MB = 5 * 1024 * 1024;
const pdf = new File(["x"], "id.pdf", { type: "application/pdf" });

// applyAccept is off so the component's own check runs, as it does for drag and drop.
const user = () => userEvent.setup({ applyAccept: false });

describe("matchesAccept", () => {
  test("extensions, exact types and wildcards", () => {
    expect(matchesAccept({ name: "a.PDF", type: "application/pdf" }, ".pdf")).toBe(true);
    expect(matchesAccept({ name: "a.png", type: "image/png" }, "image/*")).toBe(true);
    expect(matchesAccept({ name: "a.png", type: "image/png" }, "image/jpeg,application/pdf")).toBe(false);
    expect(matchesAccept({ name: "a.exe", type: "" }, ".pdf,image/*")).toBe(false);
    expect(matchesAccept({ name: "a.exe", type: "" }, undefined)).toBe(true);
  });
});

describe("FileUpload states", () => {
  test("default: label, hint and a way to choose a file", () => {
    render(<FileUpload label="Government ID" hint="JPG, PNG or PDF, up to 5 MB" onSelect={() => {}} />);
    const input = screen.getByLabelText("Government ID");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAccessibleDescription("JPG, PNG or PDF, up to 5 MB");
    expect(screen.getByText("Choose a file or drag it here")).toBeInTheDocument();
  });

  test("a valid file is passed to onSelect", async () => {
    const onSelect = vi.fn();
    render(<FileUpload label="Government ID" accept=".pdf,image/*" maxBytes={FIVE_MB} onSelect={onSelect} />);
    await user().upload(screen.getByLabelText("Government ID"), pdf);
    expect(onSelect).toHaveBeenCalledWith(pdf);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("error: a file that is too large is refused with a message", async () => {
    const onSelect = vi.fn();
    const big = new File([new Uint8Array(FIVE_MB + 1)], "big.pdf", { type: "application/pdf" });
    render(<FileUpload label="Government ID" accept=".pdf" maxBytes={FIVE_MB} onSelect={onSelect} />);
    await user().upload(screen.getByLabelText("Government ID"), big);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("This file is too large. Choose a file under 5 MB.");
    expect(screen.getByLabelText("Government ID")).toHaveAttribute("aria-invalid", "true");
  });

  test("error: the wrong type is refused and the message names what is allowed", async () => {
    const onSelect = vi.fn();
    const exe = new File(["x"], "setup.exe", { type: "application/x-msdownload" });
    render(<FileUpload label="Government ID" accept=".pdf,image/*" acceptLabel="a JPG, PNG or PDF" onSelect={onSelect} />);
    await user().upload(screen.getByLabelText("Government ID"), exe);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("This file type is not allowed. Choose a JPG, PNG or PDF.");
  });

  test("error from the server is shown", () => {
    render(<FileUpload label="Government ID" error="Upload failed. Check your connection and try again." onSelect={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Upload failed. Check your connection and try again.");
  });

  test("a good file after a bad one clears the message", async () => {
    const onSelect = vi.fn();
    const exe = new File(["x"], "setup.exe", { type: "application/x-msdownload" });
    render(<FileUpload label="Government ID" accept=".pdf" onSelect={onSelect} />);
    const u = user();
    await u.upload(screen.getByLabelText("Government ID"), exe);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await u.upload(screen.getByLabelText("Government ID"), pdf);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test("loading: shows progress and blocks a second upload", () => {
    render(<FileUpload label="Government ID" progress={40} onSelect={() => {}} />);
    const bar = screen.getByRole("progressbar", { name: "Uploading Government ID" });
    expect(bar).toHaveAttribute("value", "40");
    expect(screen.getByLabelText("Government ID")).toBeDisabled();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  test("success: shows the file name and Remove file calls onRemove", async () => {
    const onRemove = vi.fn();
    render(<FileUpload label="Government ID" fileName="id.pdf" onSelect={() => {}} onRemove={onRemove} />);
    expect(screen.getByText("id.pdf")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove file" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test("disabled", () => {
    render(<FileUpload label="Government ID" disabled onSelect={() => {}} />);
    expect(screen.getByLabelText("Government ID")).toBeDisabled();
  });
});
