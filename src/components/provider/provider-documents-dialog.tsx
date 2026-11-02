"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Eye, FileText, Trash2, Upload } from "lucide-react";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusMessage } from "@/components/ui/status-message";
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_SLOTS,
  REQUIRED_DOCUMENT_KINDS,
  documentProblem,
  formatBytes,
  resolveMime,
  type DocumentKind,
} from "@/lib/provider/documents";
import styles from "./provider-documents-dialog.module.css";

export type ProviderFiles = Partial<Record<DocumentKind, File>>;

/** How many required documents are uploaded. Shared with the form so both show the same count. */
export function requiredUploaded(files: ProviderFiles): { done: number; total: number; missing: string[] } {
  const missing = DOCUMENT_SLOTS.filter((slot) => slot.required && !files[slot.kind]).map((slot) => slot.label);
  return { done: REQUIRED_DOCUMENT_KINDS.length - missing.length, total: REQUIRED_DOCUMENT_KINDS.length, missing };
}

type Props = {
  open: boolean;
  files: ProviderFiles;
  onChange: (kind: DocumentKind, file: File | undefined) => void;
  /** Called by Save and by closing the popup. Files are kept either way. */
  onClose: () => void;
};

/** Popup where an applicant uploads, views and deletes each requirement. Files stay in the browser until Apply. */
export function ProviderDocumentsDialog({ open, files, onChange, onClose }: Props) {
  const inputs = useRef<Partial<Record<DocumentKind, HTMLInputElement | null>>>({});
  const [errors, setErrors] = useState<Partial<Record<DocumentKind, string>>>({});
  const progress = requiredUploaded(files);

  function choose(kind: DocumentKind, event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    const slot = DOCUMENT_SLOTS.find((item) => item.kind === kind);
    if (!slot) return;
    const problem = documentProblem(picked, slot);
    if (problem) {
      setErrors((current) => ({ ...current, [kind]: problem }));
      return;
    }
    setErrors((current) => ({ ...current, [kind]: undefined }));
    // Some browsers leave the type empty for Word files. Store the real type so the server accepts it.
    const mime = resolveMime(picked) ?? picked.type;
    onChange(kind, picked.type === mime ? picked : new File([picked], picked.name, { type: mime }));
  }

  function remove(kind: DocumentKind) {
    setErrors((current) => ({ ...current, [kind]: undefined }));
    onChange(kind, undefined);
  }

  function view(file: File) {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener");
    // Give the new tab time to load the file, then free the memory.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload your documents"
      footer={
        <ButtonGroup>
          <Button variant="primary" onClick={onClose}>Save documents</Button>
        </ButtonGroup>
      }
    >
      <p className={styles.accepted}>
        Accepted files: PDF, DOC, DOCX, PNG, JPG or WebP, up to {formatBytes(DOCUMENT_MAX_BYTES)} each.
        The selfie must be PNG, JPG or WebP. Only admins can see your documents.
      </p>
      <StatusMessage status={progress.missing.length ? "info" : "success"}>
        {progress.missing.length
          ? `${progress.done} of ${progress.total} required documents uploaded.`
          : "All required documents are uploaded. Save to continue."}
      </StatusMessage>
      <ul className={styles.list}>
        {DOCUMENT_SLOTS.map((slot) => {
          const file = files[slot.kind];
          const error = errors[slot.kind];
          const inputId = `provider-doc-${slot.kind}`;
          return (
            <li key={slot.kind} className={styles.row}>
              <div className={styles.heading}>
                <span className={styles.label}>{slot.label}</span>
                <span className={styles.tag}>{slot.required ? "Required" : "Optional"}</span>
              </div>
              <p className={styles.hint}>{slot.hint}</p>
              {file ? (
                <p className={styles.file}>
                  <FileText className={styles.icon} aria-hidden="true" />
                  <span className={styles.fileName}>{file.name}</span>
                  <span className={styles.fileSize}>{formatBytes(file.size)}</span>
                </p>
              ) : (
                <p className={styles.empty}>Not uploaded yet.</p>
              )}
              {error && <StatusMessage status="error">{error}</StatusMessage>}
              <div className={styles.actions}>
                <input
                  ref={(node) => { inputs.current[slot.kind] = node; }}
                  id={inputId}
                  className={styles.input}
                  type="file"
                  tabIndex={-1}
                  accept={slot.types.join(",")}
                  onChange={(event) => choose(slot.kind, event)}
                />
                <Button onClick={() => inputs.current[slot.kind]?.click()} aria-label={`${file ? "Replace" : "Upload"} ${slot.label}`}>
                  <Upload className={styles.icon} aria-hidden="true" />
                  {file ? "Replace" : "Upload"}
                </Button>
                {file && (
                  <>
                    <Button onClick={() => view(file)} aria-label={`View ${slot.label}`}>
                      <Eye className={styles.icon} aria-hidden="true" />
                      View
                    </Button>
                    <Button onClick={() => remove(slot.kind)} aria-label={`Delete ${slot.label}`}>
                      <Trash2 className={styles.icon} aria-hidden="true" />
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
