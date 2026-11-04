"use client";
import { useState } from "react";
import { ActionLink } from "@/components/ui/action-link";
import { Modal } from "@/components/ui/modal";
import styles from "./document-preview.module.css";
export function DocumentPreview({
  applicantId,
  kind,
  label,
}: {
  applicantId: string;
  kind: string;
  label?: string;
}) {
  const [opened, setOpened] = useState(false);
  const title = label ?? kind.replaceAll("_", " ");
  const documentUrl = `/api/admin/provider-applications/${applicantId}/documents?kind=${encodeURIComponent(kind)}`;
  return (
    <>
      <button
        type="button"
        className={styles.openButton}
        onClick={() => setOpened(true)}
      >
        Preview {title}
      </button>
      {opened && (
        <Modal open wide title={title} onClose={() => setOpened(false)}>
          <iframe
            className={styles.frame}
            src={documentUrl}
            title={`${title} document preview`}
          />
          <ActionLink
            className={styles.newTab}
            href={documentUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in a new tab
          </ActionLink>
        </Modal>
      )}
    </>
  );
}
