"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/matching/client";
import styles from "./workflow.module.css";
export function PortfolioPublishForm({
  bookingId,
  paths,
}: {
  bookingId: string;
  paths: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      className={styles.form}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const f = new FormData(e.currentTarget);
        setBusy(true);
        const error = await postJson(`/api/workflow/${bookingId}`, {
          action: "admin_publish",
          data: {
            title: f.get("title"),
            note: f.get("note"),
            privacyChecked: f.has("privacy"),
            photos: f.getAll("photos"),
          },
        });
        setMessage(
          error ?? "Reviewed project published with customer consent.",
        );
        setBusy(false);
        if (!error) router.refresh();
      }}
    >
      <label>
        Public project title
        <input
          name="title"
          minLength={3}
          maxLength={120}
          required
          placeholder="Example: Kitchen sink leak repair"
        />
      </label>
      <label>
        Public-safe description
        <textarea
          name="note"
          minLength={10}
          maxLength={2000}
          required
          placeholder="Example: Replaced a damaged sink trap and tested the repaired connection for leaks. Photos show the completed work with customer permission."
        />
        <small className={styles.muted}>
          Describe the work only. Leave out customer names, exact addresses,
          contact numbers and other identifying details.
        </small>
      </label>
      <fieldset>
        <legend>Select approved photos (open evidence above to inspect)</legend>
        {paths.map((path, index) => (
          <label key={path}>
            <input type="checkbox" name="photos" value={path} />
            Approved evidence photo {index + 1} ({path.split("/").at(-1)})
          </label>
        ))}
      </fieldset>
      <label>
        <input type="checkbox" name="privacy" required />I checked selected
        photos, title and description for faces, names, addresses, landmarks,
        documents and other identifying details.
      </label>
      {message && <p role="status">{message}</p>}
      <Button type="submit" disabled={busy || !paths.length} loading={busy}>
        Publish reviewed project
      </Button>
    </form>
  );
}
