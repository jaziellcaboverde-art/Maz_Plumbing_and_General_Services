import { describe, expect, test } from "vitest";
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_SLOTS,
  REQUIRED_DOCUMENT_KINDS,
  documentProblem,
  resolveMime,
  slotFor,
} from "@/lib/provider/documents";
import { REQUIRED_PROVIDER_DOCUMENTS } from "@/lib/provider/requirements";

const file = (name: string, type: string, size = 1000) => ({ name, type, size });

describe("provider document rules", () => {
  test("every required upload from the requirements list has a slot", () => {
    expect(REQUIRED_DOCUMENT_KINDS).toEqual(["government_id", "selfie", "nbi_clearance", "proof_of_address"]);
    // "Two references and years of experience" are form fields, not uploads.
    expect(REQUIRED_PROVIDER_DOCUMENTS).toHaveLength(REQUIRED_DOCUMENT_KINDS.length);
    expect(DOCUMENT_SLOTS.filter((slot) => !slot.required).map((slot) => slot.kind)).toEqual(["skill_certificate", "resume", "medical_certificate"]);
  });

  test("accepts PDF, DOC, DOCX, PNG, JPG and WebP for a normal slot", () => {
    const slot = slotFor("government_id")!;
    for (const [name, type] of [
      ["id.pdf", "application/pdf"], ["id.png", "image/png"], ["id.jpg", "image/jpeg"], ["id.webp", "image/webp"],
      ["id.doc", "application/msword"],
      ["id.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ]) expect(documentProblem(file(name, type), slot)).toBeNull();
  });

  test("falls back to the extension when the browser leaves the type empty", () => {
    expect(resolveMime(file("resume.docx", ""))).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(resolveMime(file("scan.PDF", ""))).toBe("application/pdf");
    expect(resolveMime(file("notes.txt", "text/plain"))).toBeNull();
  });

  test("the selfie takes images only", () => {
    const selfie = slotFor("selfie")!;
    expect(documentProblem(file("me.jpg", "image/jpeg"), selfie)).toBeNull();
    expect(documentProblem(file("me.pdf", "application/pdf"), selfie)).toMatch(/not accepted/);
    expect(documentProblem(file("me.docx", ""), selfie)).toMatch(/not accepted/);
  });

  test("refuses unknown types, empty files and files over the limit", () => {
    const slot = slotFor("nbi_clearance")!;
    expect(documentProblem(file("a.exe", "application/octet-stream"), slot)).toMatch(/PDF, DOC, DOCX, PNG, JPG or WebP/);
    expect(documentProblem(file("a.pdf", "application/pdf", 0), slot)).toMatch(/empty/);
    expect(documentProblem(file("a.pdf", "application/pdf", DOCUMENT_MAX_BYTES + 1), slot)).toMatch(/too large/);
    expect(documentProblem(file("a.pdf", "application/pdf", DOCUMENT_MAX_BYTES), slot)).toBeNull();
  });
});
