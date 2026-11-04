"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusMessage } from "@/components/ui/status-message";
import { createClient } from "@/lib/supabase/browser";
import styles from "./workspace.module.css";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const UPDATE_LABELS: Record<string, string> = {
  inspection: "Inspection findings",
  progress: "Progress update",
  milestone: "Milestone evidence",
  change_request: "Additional work request",
  issue: "Report an issue / request replacement",
  completion: "Submit assigned work for completion review",
};

export function WorkUpdateForm({
  bookingId,
  inProgress,
  milestones,
  initialKind = "inspection",
}: {
  bookingId: string;
  initialKind?: string;
  inProgress: boolean;
  milestones: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState(initialKind);
  const [notes, setNotes] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Keep the key and uploaded paths across a failed request so retries do not duplicate records.
  const [hasPending, setHasPending] = useState(false);
  const pending = useRef<{ key: string; paths: string[] } | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const client = createClient();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) throw new Error("Sign in again before submitting.");
      if (!pending.current)
        pending.current = { key: crypto.randomUUID(), paths: [] };
      setHasPending(true);
      const submission = pending.current;
      for (let index = submission.paths.length; index < files.length; index++) {
        const file = files[index];
        const path = `${bookingId}/${user.id}/${submission.key}-${index}.${TYPES[file.type]}`;
        const { error: uploadError } = await client.storage
          .from("proof-photos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (
          uploadError &&
          uploadError.message !== "The resource already exists"
        )
          throw new Error(
            "A photo could not be uploaded. Retry your submission.",
          );
        submission.paths.push(path);
      }
      const response = await fetch("/api/provider/work-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          kind,
          notes,
          photoPaths: submission.paths,
          milestoneId: kind === "milestone" ? milestoneId : null,
          key: submission.key,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.error ?? "Could not submit your update.");
      pending.current = null;
      setHasPending(false);
      setNotes("");
      setFiles([]);
      setNotice("Submitted to MAZ for review.");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Connection failed. Retry your submission.",
      );
    } finally {
      setBusy(false);
    }
  }
  const requiresPhotos = kind === "milestone" || kind === "completion";
  return (
    <form className={styles.form} onSubmit={submit}>
      <h2>Send an update to MAZ</h2>
      <p className={styles.muted}>
        Include findings, measurements and risks. Extra work needs MAZ and
        customer approval. MAZ reviews your photos before sharing customer
        updates. Completed work can appear in the service portfolio only after
        publication approval and customer consent.
      </p>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      {notice && <StatusMessage status="success">{notice}</StatusMessage>}
      <label htmlFor="work-update-kind">Update type</label>
      <select
        id="work-update-kind"
        value={kind}
        disabled={busy || hasPending}
        onChange={(e) => setKind(e.target.value)}
      >
        {Object.entries(UPDATE_LABELS)
          .filter(
            ([key]) =>
              inProgress ||
              !["progress", "milestone", "completion"].includes(key),
          )
          .map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
      </select>
      {kind === "milestone" && (
        <>
          <label htmlFor="work-milestone">Milestone</label>
          <select
            id="work-milestone"
            value={milestoneId}
            required
            disabled={busy || hasPending}
            onChange={(e) => setMilestoneId(e.target.value)}
          >
            <option value="">Choose milestone</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </>
      )}
      <Textarea
        label="Findings / work notes"
        placeholder={
          "Example: Found a cracked sink trap causing the leak. Replaced the approved part and tested the connection for 10 minutes. No leak observed. Attached before/after photos. Items needing MAZ review: [actual observations]."
        }
        hint="At least 10 characters. Explain the work and anything MAZ needs to review."
        value={notes}
        minLength={10}
        maxLength={4000}
        required
        disabled={busy || hasPending}
        onChange={(e) => setNotes(e.target.value)}
      />
      <label htmlFor="work-photos">
        Evidence photos {requiresPhotos ? "(required)" : "(optional)"}
      </label>
      <input
        key={notice ?? "photos"}
        id="work-photos"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={busy || hasPending}
        onChange={(e) => {
          const selected = Array.from(e.target.files ?? []);
          if (
            selected.length > 10 ||
            selected.some((f) => !TYPES[f.type] || f.size > 10 * 1024 * 1024)
          ) {
            setError(
              "Choose up to 10 JPG, PNG or WebP photos, at most 10 MB each.",
            );
            e.target.value = "";
            setFiles([]);
            return;
          }
          setError(null);
          setFiles(selected);
        }}
      />
      <p className={styles.muted}>
        Photos stay private. Submitting evidence does not authorize publication.
      </p>
      <Button
        type="submit"
        variant="primary"
        loading={busy}
        disabled={
          busy ||
          notes.trim().length < 10 ||
          (requiresPhotos && !files.length) ||
          (kind === "milestone" && !milestoneId)
        }
      >
        Submit to MAZ
      </Button>
    </form>
  );
}
