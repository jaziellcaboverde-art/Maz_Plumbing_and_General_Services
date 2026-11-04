"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionLink } from "@/components/ui/action-link";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/matching/client";
import { manilaInputToISO } from "@/lib/provider/time";
import { peso } from "@/lib/matching/format";
import { quotationDeposit } from "@/lib/workflow/deposit";
import { parseReceiptCsv } from "@/lib/workflow/receipt-import";
import type { WorkflowQuote } from "@/lib/workflow/load";
import styles from "./workflow.module.css";
export function QuoteBuilder({
  bookingId,
  contractRequired = false,
}: {
  bookingId: string;
  contractRequired?: boolean;
  milestones: { id: string; title: string }[];
  initialQuote?: WorkflowQuote;
}) {
  const router = useRouter();
  const [receipt, setReceipt] = useState<{
    csv: string;
    name: string;
    items: { description: string; quantity: number; unitPrice: number }[];
    total: number;
  } | null>(null);
  const items = receipt?.items ?? [];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<Record<string, unknown> | null>(null);
  const [sent, setSent] = useState(false);
  const total = receipt?.total ?? 0;
  const deposit = quotationDeposit(total, contractRequired);
  return (
    <form
      className={styles.form}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || sent) return;
        const f = new FormData(e.currentTarget);
        if (!review) {
          if (!receipt) {
            setMessage("Import the expense receipt CSV first.");
            return;
          }
          setMessage("");
          setReview({
            receiptCsv: receipt.csv,
            receiptName: receipt.name,
            schedule: [],
            deposit,

            expiresAt: manilaInputToISO(String(f.get("expiry"))),
          });
          return;
        }
        setBusy(true);
        const error = await postJson(`/api/workflow/${bookingId}`, {
          action: "admin_quote",
          data: review,
        });
        setMessage(error ?? "Quotation issued and approved by MAZ.");
        setBusy(false);
        if (!error) {
          setSent(true);
          router.refresh();
        }
      }}
    >
      <div hidden={!!review || sent}>
        <h3>Import expense receipt</h3>
        <ActionLink href="/samples/quotation-receipt.csv" download>
          Download sample CSV
        </ActionLink>
        <label>
          Expense receipt (CSV)
          <input
            type="file"
            accept=".csv,text/csv"
            required
            disabled={busy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              setReceipt(null);
              setMessage("");
              if (!file) return;
              if (file.size > 65536) {
                setMessage("Use a CSV file no larger than 64 KB.");
                return;
              }
              try {
                const csv = await file.text();
                const parsed = parseReceiptCsv(csv);
                setReceipt({ csv, name: file.name, ...parsed });
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Could not read the receipt.",
                );
              }
            }}
          />
        </label>
        <small>
          Include all labor, materials and other expenses, followed by a TOTAL
          row. Amounts are in PHP.
        </small>
        {receipt && (
          <p>
            {receipt.name}: {items.length} expenses -{" "}
            <strong>{peso(total)}</strong>
          </p>
        )}
        <section className={styles.card} aria-label="Automatic payment summary">
          <p>
            Subtotal: <strong>{peso(total)}</strong>
          </p>
          <p>
            {contractRequired ? "Down payment (50%)" : "Full payment (100%)"}:{" "}
            <strong>{peso(contractRequired ? deposit : total)}</strong>
          </p>
          <p>
            {contractRequired
              ? "Required contract: 50% before work; the remaining balance after MAZ completion approval."
              : "No contract: no down payment. Payment is due after MAZ completion approval."}
          </p>
          <small>
            Verified inspection payments are credited toward the amount due.
          </small>
        </section>
        <label>
          Quote valid until (Philippine time)
          <input name="expiry" type="datetime-local" required />
          <small className={styles.muted}>
            Customer approval deadline, in Philippine time.
          </small>
        </label>
      </div>
      {review && !sent && (
        <section className={styles.card} aria-label="Review quotation">
          <h3>Review quotation before sending</h3>
          <p>
            Total: <strong>{peso(total)}</strong>
          </p>
          <ul>
            {items.map((item, index) => (
              <li key={index}>
                {item.description}: {item.quantity} × {peso(item.unitPrice)}
              </li>
            ))}
          </ul>
          <p>
            {contractRequired ? "Down payment (50%)" : "Full payment (100%)"}:{" "}
            {peso(contractRequired ? Number(review.deposit) : total)}
          </p>
          <p>Imported receipt: {String(review.receiptName)}</p>
          <p>
            MAZ will issue an approved version. Existing approved records remain
            unchanged.
          </p>
          <Button onClick={() => setReview(null)} disabled={busy}>
            Edit quotation
          </Button>
        </section>
      )}
      {message && <p role="status">{message}</p>}
      {!sent && (
        <Button
          type="submit"
          variant="primary"
          disabled={busy || total <= 0}
          loading={busy}
        >
          {review ? "Issue quotation" : "Review quotation"}
        </Button>
      )}
    </form>
  );
}
