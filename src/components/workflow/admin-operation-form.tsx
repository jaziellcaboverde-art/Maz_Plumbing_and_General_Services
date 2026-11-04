"use client";
import { useId, useState } from "react";
import { fieldGuide } from "./field-guide";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { manilaInputToISO } from "@/lib/provider/time";
import type { AdminOperation } from "@/lib/workflow/admin-rules";
import type { ActionField } from "./action-form";
import styles from "./workflow.module.css";
export function AdminOperationForm({
  operation,
  values = {},
  fields = [],
  label,
}: {
  operation: AdminOperation;
  values?: Record<string, unknown>;
  fields?: ActionField[];
  label: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const guideId = useId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      className={styles.form}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = new FormData(e.currentTarget),
          data = { ...values };
        for (const f of fields) {
          const v = String(form.get(f.name) ?? "");
          data[f.name] =
            f.type === "checkbox"
              ? form.has(f.name)
              : f.type === "datetime-local"
                ? manilaInputToISO(v)
                : v;
        }
        setBusy(true);
        try {
          const response = await fetch("/api/admin/workflow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation, data }),
          });
          const json = await response.json();
          setMessage(json.error ?? "Saved.");
          if (response.ok) {
            toast.show({ status: "success", message: "Saved." });
            if (operation === "create" && json.id)
              router.push(`/admin/bookings/${json.id}`);
            router.refresh();
          }
        } catch {
          setMessage("Could not reach MAZ. Please retry.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {fields.map((f) => {
        const guide = fieldGuide(operation, f.name, values);
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
                  defaultValue={String(f.value ?? "")}
                  maxLength={4000}
                />
              ) : f.type === "select" ? (
                <select
                  aria-describedby={hint ? hintId : undefined}
                  name={f.name}
                  required={f.required}
                  defaultValue={String(f.value ?? "")}
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
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
                  defaultValue={
                    f.type === "checkbox" ? undefined : String(f.value ?? "")
                  }
                  defaultChecked={
                    f.type === "checkbox" ? Boolean(f.value) : undefined
                  }
                  required={f.required}
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
      {message && <p role="status">{message}</p>}
      <Button type="submit" variant="primary" loading={busy} disabled={busy}>
        {label}
      </Button>
    </form>
  );
}
export function GatewayRefundForm({
  bookingId,
  requestId,
}: {
  bookingId: string;
  requestId: string;
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
        const reference = new FormData(e.currentTarget).get("reference");
        setBusy(true);
        try {
          const response = await fetch(`/api/workflow/${bookingId}/refund`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId, reference }),
          });
          const data = await response.json();
          setMessage(data.error ?? "Gateway refund verified and recorded.");
          if (response.ok) router.refresh();
        } catch {
          setMessage(
            "Could not verify the refund. Retry with the same reference.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        Issue the approved amount in the PayMongo dashboard, then verify its
        refund reference here. Only a matching succeeded refund is recorded.
      </p>
      <label>
        PayMongo refund reference
        <input
          name="reference"
          pattern="ref_[A-Za-z0-9]+"
          required
          placeholder="ref_…"
        />
      </label>
      {message && <p role="status">{message}</p>}
      <Button type="submit" disabled={busy} loading={busy}>
        Verify gateway refund
      </Button>
    </form>
  );
}

export function CheckoutReconcileForm({
  paymentId,
  sessionId,
}: {
  paymentId: string;
  sessionId: string | null;
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
        const id = new FormData(e.currentTarget).get("session");
        setBusy(true);
        try {
          const response = await fetch("/api/admin/workflow/reconcile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId, sessionId: id }),
          });
          const result = await response.json();
          setMessage(
            result.error ?? `Canonical gateway state: ${result.state}.`,
          );
          if (response.ok) router.refresh();
        } catch {
          setMessage(
            "Could not reconcile the checkout. Retry with the same ID.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        Payment reference: {paymentId}. Find the existing session in PayMongo
        using this reference. This retrieves its state and never creates another
        charge.
      </p>
      <label>
        Existing PayMongo checkout ID
        <input
          name="session"
          defaultValue={sessionId ?? ""}
          pattern="cs_[A-Za-z0-9]+"
          required
        />
      </label>
      {message && <p role="status">{message}</p>}
      <Button type="submit" disabled={busy} loading={busy}>
        Retrieve and reconcile existing checkout
      </Button>
    </form>
  );
}
