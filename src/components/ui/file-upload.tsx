"use client";

import { useId, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { cx } from "@/lib/cx";
import { Button } from "./button";
import { Field } from "./field";
import { Spinner } from "./spinner";
import styles from "./file-upload.module.css";

type FileUploadProps = {
  label: string;
  /** Say what is allowed: "JPG, PNG or PDF, up to 5 MB". */
  hint?: string;
  /** Same format as the HTML accept attribute: ".pdf,image/*". */
  accept?: string;
  maxBytes?: number;
  /** Used in the "wrong type" message: "JPG, PNG or PDF". */
  acceptLabel?: string;
  /** Name of the chosen file. Setting it shows the success state. */
  fileName?: string;
  /** 0 to 100 while uploading. Setting it shows the uploading state. */
  progress?: number;
  /** A failure from the server. Say how to fix it. */
  error?: string;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onRemove?: () => void;
};

export function matchesAccept(file: Pick<File, "name" | "type">, accept?: string): boolean {
  if (!accept) return true;
  const rules = accept.split(",").map((rule) => rule.trim().toLowerCase()).filter(Boolean);
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return rules.some((rule) =>
    rule.startsWith(".") ? name.endsWith(rule) : rule.endsWith("/*") ? type.startsWith(rule.slice(0, -1)) : type === rule,
  );
}

function formatMegabytes(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

export function FileUpload({
  label,
  hint,
  accept,
  maxBytes,
  acceptLabel,
  fileName,
  progress,
  error,
  disabled = false,
  onSelect,
  onRemove,
}: FileUploadProps) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string>();

  const uploading = progress !== undefined;
  const message = error ?? localError;

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!matchesAccept(file, accept)) {
      setLocalError(`This file type is not allowed. Choose ${acceptLabel ?? "a supported file"}.`);
      return;
    }
    if (maxBytes !== undefined && file.size > maxBytes) {
      setLocalError(`This file is too large. Choose a file under ${formatMegabytes(maxBytes)}.`);
      return;
    }
    setLocalError(undefined);
    onSelect(file);
  }

  return (
    <Field id={id} label={label} hint={hint} message={message} status={message ? "error" : "default"}>
      {({ describedBy, invalid }) => (
        <div className={styles.root}>
          {fileName && !uploading ? (
            <div className={styles.done}>
              <FileText className={styles.icon} aria-hidden="true" />
              <p className={styles.name}>
                <span className="sr-only">Uploaded file: </span>
                {fileName}
              </p>
              {onRemove && (
                <Button onClick={onRemove} disabled={disabled}>
                  Remove file
                </Button>
              )}
            </div>
          ) : (
            <div className={cx(styles.zone, dragging && styles.dragging, invalid && styles.invalid, disabled && styles.disabled)}>
              {uploading ? (
                <div className={styles.progress} role="status">
                  <Spinner />
                  <progress className={styles.bar} value={progress} max={100} aria-label={`Uploading ${label}`} />
                  <span>{progress}%</span>
                </div>
              ) : (
                <>
                  <Upload className={styles.icon} aria-hidden="true" />
                  <span className={styles.prompt}>Choose a file or drag it here</span>
                </>
              )}
              <input
                id={id}
                className={styles.input}
                type="file"
                accept={accept}
                disabled={disabled || uploading}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                onChange={(event) => {
                  handleFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
                onDragEnter={() => setDragging(true)}
                onDragLeave={() => setDragging(false)}
                onDrop={() => setDragging(false)}
              />
            </div>
          )}
        </div>
      )}
    </Field>
  );
}
