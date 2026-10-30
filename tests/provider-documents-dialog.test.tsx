import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ProviderDocumentsDialog, requiredUploaded, type ProviderFiles } from "@/components/provider/provider-documents-dialog";
import type { DocumentKind } from "@/lib/provider/documents";

afterEach(cleanup);

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [files, setFiles] = useState<ProviderFiles>({});
  return <ProviderDocumentsDialog
    open
    files={files}
    onChange={(kind: DocumentKind, file) => setFiles((current) => ({ ...current, [kind]: file }))}
    onClose={onClose}
  />;
}

const row = (label: string) => screen.getByText(label).closest("li") as HTMLElement;
const inputIn = (li: HTMLElement) => li.querySelector("input[type=file]") as HTMLInputElement;

describe("provider documents popup", () => {
  test("says which files are accepted and how big they may be", () => {
    render(<Harness />);
    expect(screen.getByText(/PDF, DOC, DOCX, PNG, JPG or WebP, up to 5 MB each/)).toBeInTheDocument();
    expect(screen.getByText("0 of 4 required documents uploaded.")).toBeInTheDocument();
  });

  test("upload shows the file with View and Delete, and delete clears it", async () => {
    render(<Harness />);
    const nbi = row("NBI clearance");
    await userEvent.upload(inputIn(nbi), new File(["x"], "nbi.pdf", { type: "application/pdf" }));
    expect(within(nbi).getByText("nbi.pdf")).toBeInTheDocument();
    expect(within(nbi).getByRole("button", { name: "View NBI clearance" })).toBeInTheDocument();
    expect(within(nbi).getByRole("button", { name: "Replace NBI clearance" })).toBeInTheDocument();
    expect(screen.getByText("1 of 4 required documents uploaded.")).toBeInTheDocument();

    await userEvent.click(within(nbi).getByRole("button", { name: "Delete NBI clearance" }));
    expect(within(nbi).queryByText("nbi.pdf")).not.toBeInTheDocument();
    expect(within(nbi).getByText("Not uploaded yet.")).toBeInTheDocument();
  });

  test("View opens the chosen file in a new tab", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
    render(<Harness />);
    const id = row("Government ID");
    await userEvent.upload(inputIn(id), new File(["x"], "id.png", { type: "image/png" }));
    await userEvent.click(within(id).getByRole("button", { name: "View Government ID" }));
    expect(open).toHaveBeenCalledWith("blob:test", "_blank", "noopener");
    open.mockRestore();
  });

  test("a Word file with no browser type is stored with its real type", async () => {
    let saved: File | undefined;
    render(<ProviderDocumentsDialog open files={{}} onChange={(_kind, file) => { saved = file; }} onClose={() => {}} />);
    await userEvent.upload(inputIn(row("Resume or work history")), new File(["x"], "cv.docx", { type: "" }), { applyAccept: false });
    expect(saved?.type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  test("a wrong file type is refused with a message and not stored", async () => {
    render(<Harness />);
    const selfie = row("Selfie holding your ID");
    await userEvent.upload(inputIn(selfie), new File(["x"], "me.pdf", { type: "application/pdf" }), { applyAccept: false });
    expect(within(selfie).getByText(/not accepted. Choose PNG, JPG or WebP/)).toBeInTheDocument();
    expect(within(selfie).getByText("Not uploaded yet.")).toBeInTheDocument();
  });

  test("Save documents closes the popup", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Save documents" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("requiredUploaded lists what is still missing", () => {
    const result = requiredUploaded({ government_id: new File(["x"], "a.png", { type: "image/png" }) });
    expect(result).toMatchObject({ done: 1, total: 4 });
    expect(result.missing).toEqual(["Selfie holding your ID", "NBI clearance", "Barangay clearance or proof of address"]);
  });
});
