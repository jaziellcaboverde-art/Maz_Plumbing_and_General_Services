"use client";

import { useRef, useState } from "react";
import styles from "./document-preview.module.css";

export function DocumentPreview({ applicantId, kind }: { applicantId: string; kind: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);
  const title = kind.replaceAll("_", " ");
  const documentUrl = `/api/admin/provider-applications/${applicantId}/documents?kind=${encodeURIComponent(kind)}`;

  function openPreview() {
    setOpened(true);
    dialog.current?.showModal();
  }

  function closePreview() {
    dialog.current?.close();
    setOpened(false);
  }

  return <>
    <button type="button" className={styles.openButton} onClick={openPreview}>Preview {title}</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={`document-title-${kind}`} onClose={() => setOpened(false)}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 id={`document-title-${kind}`}>{title}</h2>
          <button type="button" className={styles.closeButton} onClick={closePreview} aria-label="Close document preview">Close</button>
        </header>
        {opened && <iframe className={styles.frame} src={documentUrl} title={`${title} document preview`} />}
        <a className={styles.newTab} href={documentUrl} target="_blank" rel="noreferrer">Open in a new tab</a>
      </div>
    </dialog>
  </>;
}
