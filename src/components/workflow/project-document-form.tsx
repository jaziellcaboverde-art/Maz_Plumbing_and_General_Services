"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/matching/client";
import styles from "./workflow.module.css";
import approval from "./approval.module.css";

export function ProjectDocumentForm({
  bookingId,
  quotation,
  kind,
}: {
  bookingId: string;
  quotation: { id: string; version: number };
  kind: "contract" | "change_order";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const contract = kind === "contract";
  const fields = contract
    ? [
        ["scope", "Scope and terms"],
        ["responsibilities", "Responsibilities"],
        ["schedule", "Work schedule"],
        ["paymentTerms", "Payment terms"],
        ["warranty", "Warranty / conditions (optional)"],
      ]
    : [
        ["scope", "Additional work description"],
        ["reason", "Reason for additional work"],
        ["schedule", "Schedule impact (optional)"],
        ["evidence", "Supporting evidence (optional)"],
      ];
  return (
    <form
      className={styles.form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || sent) return;
        const values = new FormData(event.currentTarget);
        const note = [
          `Related approved quotation #${quotation.version} (${quotation.id})`,
          ...fields
            .filter(([name]) => String(values.get(name) ?? "").trim())
            .map(
              ([name, label]) =>
                `${label}:\n${String(values.get(name)).trim()}`,
            ),
        ].join("\n\n");
        if (note.length > 4000) {
          setMessage("Keep the combined document within 4,000 characters.");
          return;
        }
        setBusy(true);
        const error = await postJson(`/api/workflow/${bookingId}`, {
          action: "admin_document",
          data: {
            kind,
            title: String(values.get("title")).trim(),
            note,
            costDelta: contract ? 0 : Number(values.get("costDelta")),
            daysDelta: contract ? 0 : Number(values.get("daysDelta")),
          },
        });
        setBusy(false);
        setMessage(error ?? "Sent for customer approval.");
        if (!error) {
          setSent(true);
          router.refresh();
        }
      }}
    >
      <p>Related approved quotation: #{quotation.version}</p>
      <fieldset
        disabled={busy || sent}
        className={`${styles.form} ${approval.fields}`}
      >
        <label>
          {contract ? "Contract title" : "Extra work title"}
          <input
            name="title"
            required
            minLength={3}
            maxLength={160}
            placeholder={
              contract
                ? "Kitchen renovation service contract"
                : "Replace damaged drain connection"
            }
          />
        </label>
        {fields.map(([name, label]) => (
          <label key={name}>
            {label}
            <textarea
              name={name}
              required={!label.includes("optional")}
              minLength={name === "scope" || name === "reason" ? 10 : undefined}
              maxLength={name === "scope" ? 1800 : 600}
            />
          </label>
        ))}
        {!contract && (
          <div className={styles.filterFields}>
            <label>
              Additional cost (PHP)
              <input
                name="costDelta"
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                defaultValue="0"
                required
              />
            </label>
            <label>
              Additional days
              <input
                name="daysDelta"
                type="number"
                min="0"
                max="3650"
                step="1"
                defaultValue="0"
                required
              />
            </label>
          </div>
        )}
      </fieldset>
      {!contract && (
        <p className={styles.muted}>
          The original approved scope remains in effect. Additional work needs
          customer approval and any applicable payment and schedule
          requirements.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!sent && (
        <Button type="submit" variant="primary" loading={busy} disabled={busy}>
          {contract
            ? "Send contract for customer approval"
            : "Send extra work for customer approval"}
        </Button>
      )}
    </form>
  );
}
