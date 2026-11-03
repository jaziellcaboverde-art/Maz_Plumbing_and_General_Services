"use client";
import { useId, useRef, useState } from "react";
import { fieldGuide } from "./field-guide";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/matching/client";
import { manilaInputToISO } from "@/lib/provider/time";
import type { WorkflowAction } from "@/lib/workflow/rules";
import styles from "./workflow.module.css";
export type ActionField = {
  name: string;
  label: string;
  type?:
    "text" | "textarea" | "number" | "checkbox" | "datetime-local" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
  value?: string | number | boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  hint?: string;
};
export function ActionForm({
  bookingId,
  action,
  label,
  fields = [],
  values = {},
  children,
}: {
  bookingId: string;
  action: WorkflowAction;
  label: string;
  fields?: ActionField[];
  values?: Record<string, unknown>;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const guideId = useId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [guideValues, setGuideValues] = useState(values);
  const key = useRef<string | null>(null);
  return (
    <form
      className={styles.form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = new FormData(event.currentTarget);
        const data: Record<string, unknown> = { ...values };
        for (const field of fields) {
          const value = form.get(field.name);
          data[field.name] =
            field.type === "number" || field.name === "stars"
              ? value === ""
                ? null
                : Number(value)
              : field.type === "checkbox"
                ? value === "on"
                : field.type === "datetime-local"
                  ? manilaInputToISO(String(value))
                  : String(value ?? "");
        }
        if (action === "customer_request") {
          key.current ??= crypto.randomUUID();
          data.key = key.current;
          data.paymentId = data.paymentId || null;
          data.amount = data.amount || null;
        }
        setBusy(true);
        setMessage(null);
        const error = await postJson(`/api/workflow/${bookingId}`, {
          action,
          data,
        });
        setBusy(false);
        setMessage(error ?? "Saved. Your booking is updated.");
        if (!error) {
          key.current = null;
          router.refresh();
        }
      }}
    >
      {fields.map((f) => {
        const guide = fieldGuide(action, f.name, guideValues);
        const hint = f.hint ?? guide.hint;
        const hintId = `${guideId}-${f.name}`;
        return (
          <div key={f.name} className={styles.field}>
            <label>
              {f.label}
              {f.type === "textarea" ? (
                <textarea
                  placeholder={f.placeholder ?? guide.placeholder}
                  aria-describedby={hint ? hintId : undefined}
                  name={f.name}
                  required={f.required}
                  maxLength={4000}
                  defaultValue={String(f.value ?? "")}
                  disabled={busy}
                />
              ) : f.type === "select" ? (
                <select
                  onChange={(event) =>
                    setGuideValues((current) => ({
                      ...current,
                      [f.name]: event.target.value,
                    }))
                  }
                  aria-describedby={hint ? hintId : undefined}
                  name={f.name}
                  required={f.required}
                  defaultValue={String(f.value ?? "")}
                  disabled={busy}
                >
                  {f.options?.map((o) => (
                    <option value={o.value} key={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  placeholder={f.placeholder ?? guide.placeholder}
                  aria-describedby={hint ? hintId : undefined}
                  name={f.name}
                  type={f.type ?? "text"}
                  required={f.required}
                  defaultValue={
                    f.type === "checkbox" ? undefined : String(f.value ?? "")
                  }
                  defaultChecked={
                    f.type === "checkbox" ? Boolean(f.value) : undefined
                  }
                  min={f.min}
                  max={f.max}
                  step={f.type === "number" ? "0.01" : undefined}
                  disabled={busy}
                />
              )}
            </label>
            {hint && (
              <details className={styles.fieldHelp}>
                <summary>Field guide</summary>
                <small id={hintId} className={styles.muted}>
                  {hint}
                </small>
              </details>
            )}
          </div>
        );
      })}
      {children}
      {message && <p role="status">{message}</p>}
      <Button type="submit" variant="primary" loading={busy} disabled={busy}>
        {label}
      </Button>
    </form>
  );
}
