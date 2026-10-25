import type { ReactNode } from "react";
import { Spinner } from "./spinner";
import { StatusMessage } from "./status-message";
import styles from "./field.module.css";

export type FieldStatus = "default" | "error" | "success" | "loading";

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  message?: string;
  status?: FieldStatus;
  children: (control: { describedBy?: string; invalid: boolean }) => ReactNode;
};

/** Label, hint, control and message. Shared by input, select and file upload. */
export function Field({ id, label, hint, message, status = "default", children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const messageId = message && status !== "default" ? `${id}-message` : undefined;
  const describedBy = [hintId, messageId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {children({ describedBy, invalid: status === "error" })}
      {messageId && status === "error" && (
        <StatusMessage status="error" id={messageId}>
          {message}
        </StatusMessage>
      )}
      {messageId && status === "success" && (
        <StatusMessage status="success" id={messageId}>
          {message}
        </StatusMessage>
      )}
      {messageId && status === "loading" && (
        <p id={messageId} className={styles.loading} role="status">
          <Spinner />
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}
