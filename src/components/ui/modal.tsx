"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { StatusMessage } from "./status-message";
import styles from "./modal.module.css";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  /** Buttons. Put the primary button first, ButtonGroup places it. */
  footer?: ReactNode;
  /** Shown in the body when something went wrong. Say how to fix it. */
  error?: string;
};

/** Built on the browser's dialog: focus stays inside, Escape closes, focus returns on close. */
export function Modal({ open, onClose, title, children, footer, error }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X className={styles.closeIcon} aria-hidden="true" />
          </button>
        </div>
        {error && <StatusMessage status="error">{error}</StatusMessage>}
        {children && <div className={styles.body}>{children}</div>}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </dialog>
  );
}
