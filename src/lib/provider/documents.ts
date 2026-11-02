/**
 * The documents a provider can upload when applying: which slots exist, which file types each one
 * accepts, and how big a file may be. The upload popup and the server both read this file, so the
 * rules shown to the applicant are the rules the server enforces.
 */

export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
/** Whole application request, all files together. Must stay below proxyClientMaxBodySize in next.config.ts. */
export const APPLICATION_MAX_BYTES = 60 * 1024 * 1024;

export const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

/** Extension that is stored for each accepted type. */
export const EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type DocumentKind =
  | "government_id"
  | "selfie"
  | "nbi_clearance"
  | "proof_of_address"
  | "skill_certificate"
  | "resume"
  | "medical_certificate";

export type DocumentSlot = {
  kind: DocumentKind;
  label: string;
  required: boolean;
  hint: string;
  /** MIME types this slot accepts. */
  types: readonly string[];
  /** Same text for the file picker and the "accepted files" note. */
  typesLabel: string;
};

const ANY = Object.keys(EXTENSION_BY_MIME);

export const DOCUMENT_SLOTS: readonly DocumentSlot[] = [
  { kind: "government_id", label: "Government ID", required: true, hint: "A valid ID with your photo and full name.", types: ANY, typesLabel: "PDF, DOC, DOCX, PNG, JPG or WebP" },
  { kind: "selfie", label: "Selfie holding your ID", required: true, hint: "A clear photo of you holding the same ID.", types: IMAGE_TYPES, typesLabel: "PNG, JPG or WebP" },
  { kind: "nbi_clearance", label: "NBI clearance", required: true, hint: "A valid NBI clearance.", types: ANY, typesLabel: "PDF, DOC, DOCX, PNG, JPG or WebP" },
  { kind: "proof_of_address", label: "Barangay clearance or proof of address", required: true, hint: "A barangay clearance, or a utility bill or lease from the last 3 months.", types: ANY, typesLabel: "PDF, DOC, DOCX, PNG, JPG or WebP" },
  { kind: "skill_certificate", label: "Skills certificate", required: false, hint: "For example TESDA NC II. Helps your application.", types: ANY, typesLabel: "PDF, DOC, DOCX, PNG, JPG or WebP" },
  { kind: "resume", label: "Resume or work history", required: false, hint: "A resume or a short list of your past jobs.", types: ANY, typesLabel: "PDF, DOC, DOCX, PNG, JPG or WebP" },
  { kind: "medical_certificate", label: "Medical or fit-to-work certificate", required: false, hint: "A recent certificate from a clinic.", types: ANY, typesLabel: "PDF, DOC, DOCX, PNG, JPG or WebP" },
] as const;

export const REQUIRED_DOCUMENT_KINDS = DOCUMENT_SLOTS.filter((slot) => slot.required).map((slot) => slot.kind);

export function slotFor(kind: string): DocumentSlot | undefined {
  return DOCUMENT_SLOTS.find((slot) => slot.kind === kind);
}

/** "5 MB" for the note in the popup. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

/**
 * The real type of a file. Some browsers leave the type empty for Word files, so fall back to the
 * extension. Returns null when the file is not one of the accepted types.
 */
export function resolveMime(file: Pick<File, "name" | "type">): string | null {
  const declared = file.type.toLowerCase();
  if (declared && EXTENSION_BY_MIME[declared]) return declared;
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  return (MIME_BY_EXTENSION as Record<string, string>)[extension] ?? null;
}

/** Returns a message the applicant can act on, or null when the file is fine for this slot. */
export function documentProblem(file: Pick<File, "name" | "type" | "size">, slot: DocumentSlot): string | null {
  const mime = resolveMime(file);
  if (!mime || !slot.types.includes(mime)) return `This file type is not accepted. Choose ${slot.typesLabel}.`;
  if (file.size <= 0) return "This file is empty. Choose another file.";
  if (file.size > DOCUMENT_MAX_BYTES) return `This file is too large. Choose a file under ${formatBytes(DOCUMENT_MAX_BYTES)}.`;
  return null;
}
