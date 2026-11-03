"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/matching/client";
import { peso } from "@/lib/matching/format";
import styles from "./workflow.module.css";
export function CustomerPayment({
  bookingId,
  dues,
  fee,
  instructions = [],
}: {
  bookingId: string;
  dues: {
    inspection: number;
    deposit: number;
    milestone: number;
    balance: number;
  };
  fee: number;
  instructions?: { method: string; instructions: string }[];
}) {
  const router = useRouter();
  const [purpose, setPurpose] = useState<
    "inspection" | "deposit" | "milestone" | "balance"
  >(
    dues.inspection > 0
      ? "inspection"
      : dues.deposit > 0
        ? "deposit"
        : dues.milestone > 0
          ? "milestone"
          : "balance",
  );
  const [method, setMethod] = useState("paymongo");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    key: string;
    path: string | null;
  } | null>(null);
  const amount = Number(dues[purpose]);
  if (!Object.values(dues).some((v) => Number(v) > 0))
    return (
      <p>
        No payment is currently due. MAZ confirms the next payment requirement.
      </p>
    );
  return (
    <form
      className={styles.form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setMessage(null);
        const form = new FormData(event.currentTarget);
        try {
          if (method === "paymongo") {
            const response = await fetch(
              `/api/workflow/${bookingId}/checkout`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ purpose, feeAccepted: consent }),
              },
            );
            const body = await response.json();
            if (!response.ok)
              throw Error(body.error ?? "Could not start checkout.");
            window.location.assign(body.url);
            return;
          }
          const client = createClient();
          const {
            data: { user },
          } = await client.auth.getUser();
          if (!user) throw Error("Sign in again.");
          let attempt = pending ?? { key: crypto.randomUUID(), path: null };
          setPending(attempt);
          const file = form.get("proof");
          if (file instanceof File && file.size > 0 && !attempt.path) {
            const extensions: Record<string, string> = {
              "image/jpeg": "jpg",
              "image/png": "png",
              "image/webp": "webp",
              "application/pdf": "pdf",
            };
            if (!extensions[file.type] || file.size > 10 * 1024 * 1024)
              throw Error("Use JPG, PNG, WebP or PDF up to 10 MB.");
            const path = `${bookingId}/${user.id}/${attempt.key}.${extensions[file.type]}`;
            const { error } = await client.storage
              .from("receipts")
              .upload(path, file, { contentType: file.type });
            if (error) throw Error("Proof upload failed. Please retry.");
            attempt = { ...attempt, path };
            setPending(attempt);
          }
          const error = await postJson(`/api/workflow/${bookingId}`, {
            action: "manual_payment",
            data: {
              purpose,
              amount,
              method,
              reference: String(form.get("reference") ?? ""),
              proofPath: attempt.path,
              key: attempt.key,
            },
          });
          if (error) throw Error(error);
          setPending(null);
          setMessage(
            "Proof submitted. Payment stays pending until MAZ verifies actual funds received.",
          );
          router.refresh();
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not submit payment.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Payment requirement
        <select
          value={purpose}
          disabled={busy || !!pending}
          onChange={(e) => setPurpose(e.target.value as typeof purpose)}
        >
          {Object.entries(dues)
            .filter(([, v]) => Number(v) > 0)
            .map(([key, value]) => (
              <option key={key} value={key}>
                {key} - {peso(Number(value))}
              </option>
            ))}
        </select>
      </label>
      <label>
        Payment channel
        <select
          value={method}
          disabled={busy || !!pending}
          onChange={(e) => {
            setMethod(e.target.value);
            setConsent(false);
          }}
        >
          <option value="paymongo">PayMongo hosted checkout</option>
          <option value="gcash">Manual GCash transfer</option>
          <option value="bank">Bank transfer</option>
          <option value="cash">Cash received by MAZ</option>
        </select>
      </label>
      {method === "paymongo" ? (
        <>
          <p>
            Service amount {peso(amount)} + disclosed processing fee{" "}
            {peso(Number(fee))} = {peso(amount + Number(fee))}.
          </p>
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{" "}
            I agree to the disclosed amount and processing fee.
          </label>
        </>
      ) : (
        <>
          <p>
            Use the MAZ payment instructions for your booking. Providers do not
            collect or verify customer payments.
          </p>
          <label>
            Transfer / MAZ receipt reference
            <input
              name="reference"
              minLength={3}
              maxLength={120}
              required
              disabled={busy}
            />
          </label>
          <label>
            Proof of payment {method === "cash" ? "(optional)" : "(required)"}
            <input
              type="file"
              name="proof"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required={method !== "cash" && !pending?.path}
              disabled={busy || !!pending?.path}
            />
          </label>
        </>
      )}
      {method !== "paymongo" && (
        <p className={styles.document}>
          {instructions.find((i) => i.method === method)?.instructions ??
            "Contact MAZ for verified account and payment instructions before transferring any money."}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <Button
        type="submit"
        loading={busy}
        disabled={busy || (method === "paymongo" && !consent)}
      >
        {method === "paymongo"
          ? "Continue to secure checkout"
          : "Submit for MAZ verification"}
      </Button>
    </form>
  );
}
