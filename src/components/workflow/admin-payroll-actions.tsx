"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { peso } from "@/lib/matching/format";
import styles from "./workflow.module.css";

export type PayrollCandidate = {
  work_day_id: string;
  booking_id: string;
  provider_id: string;
  provider_name: string;
  work_date: string;
  week_ending: string;
  booking_description: string | null;
  close_note: string | null;
  photo_urls: string[];
  payout_method: string | null;
  payout_account_name: string | null;
  payout_account_number: string | null;
};

export type PayrollBatch = {
  id: string;
  provider_id: string;
  week_ending: string;
  day_count: number;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  created_at: string;
  paid_at: string | null;
  provider_name: string;
  payout_account_name: string | null;
  payout_account_number: string | null;
};

const methodName: Record<string, string> = {
  gcash: "GCash",
  bank: "Bank transfer",
  cash: "Cash",
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(new Date(`${value}T00:00:00+08:00`));
}

export function AdminPayrollActions({
  candidates,
  batches,
}: {
  candidates: PayrollCandidate[];
  batches: PayrollBatch[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  const groups = new Map<string, PayrollCandidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.provider_id}:${candidate.week_ending}`;
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
    key: string,
    payload: Record<string, unknown>,
  ) {
    event.preventDefault();
    if (busy) return;
    setBusy(key);
    setMessages((current) => ({ ...current, [key]: "" }));
    try {
      const response = await fetch("/api/admin/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not save the payout.");
      setMessages((current) => ({ ...current, [key]: "Saved successfully." }));
      router.refresh();
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [key]: error instanceof Error ? error.message : "Could not save the payout.",
      }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <section className={styles.grid} aria-label="Eligible provider workdays">
        {groups.size ? (
          [...groups.entries()].map(([key, days]) => {
            const first = days[0];
            const total = days.length * 1000;
            const hasMethod = Boolean(first.payout_method);
            return (
              <article className={styles.card} key={key}>
                <h2>{first.provider_name}</h2>
                <p>
                  Week ending Saturday, {dateLabel(first.week_ending)} ·{" "}
                  {days.length} verified workday{days.length === 1 ? "" : "s"} ·{" "}
                  {peso(total)}
                </p>
                <p>
                  Payout: {methodName[first.payout_method ?? ""] ?? "Not set"}
                  {first.payout_account_name
                    ? ` · ${first.payout_account_name}`
                    : ""}
                  {first.payout_account_number
                    ? ` · ${first.payout_account_number}`
                    : ""}
                </p>
                <p>Select the workdays to include. Each selected day adds ₱1,000.</p>
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    const formData = new FormData(event.currentTarget);
                    const workDayIds = formData
                      .getAll("workDayIds")
                      .map(String);
                    void submit(event, key, {
                      action: "create",
                      providerId: first.provider_id,
                      weekEnding: first.week_ending,
                      workDayIds,
                    });
                  }}
                >
                  {days.map((day) => (
                    <div className={styles.field} key={day.work_day_id}>
                      <label>
                        <input
                          type="checkbox"
                          name="workDayIds"
                          value={day.work_day_id}
                          defaultChecked
                          disabled={!hasMethod || busy === key}
                        />{" "}
                        {dateLabel(day.work_date)} · Booking{" "}
                        {day.booking_id.slice(0, 8)}
                        {day.booking_description
                          ? ` · ${day.booking_description.slice(0, 100)}`
                          : ""}
                      </label>
                      {day.close_note && <p>Provider note: {day.close_note}</p>}
                      {day.photo_urls.length > 0 && (
                        <p>
                          {day.photo_urls.map((url, index) => (
                            <span key={url}>
                              {index > 0 ? " · " : ""}
                              <a href={url} target="_blank" rel="noreferrer">
                                Work photo {index + 1}
                              </a>
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  ))}
                  {!hasMethod && (
                    <p role="alert">
                      This provider must save a payout method in Provider
                      Settings before a batch can be created.
                    </p>
                  )}
                  {messages[key] && <p role="status">{messages[key]}</p>}
                  <Button
                    type="submit"
                    variant="primary"
                    loading={busy === key}
                    disabled={Boolean(busy) || !hasMethod}
                  >
                    Create payout batch
                  </Button>
                </form>
              </article>
            );
          })
        ) : (
          <p>No eligible unpaid workdays were found in the last 90 days.</p>
        )}
      </section>

      <section className={styles.grid} aria-label="Payout batch history">
        {batches.map((batch) => {
          const key = `batch:${batch.id}`;
          return (
            <article className={styles.card} key={batch.id}>
              <h2>{batch.provider_name}</h2>
              <p>
                Week ending {dateLabel(batch.week_ending)} · {batch.day_count}{" "}
                workday{batch.day_count === 1 ? "" : "s"} ·{" "}
                {peso(Number(batch.amount))} ·{" "}
                {methodName[batch.method] ?? batch.method}
              </p>
              {batch.status === "pending" && (
                <>
                  {batch.method === "cash" ? (
                    <p>Prepare cash for the provider and record the receipt number.</p>
                  ) : (
                    <p>
                      Pay to {batch.payout_account_name ?? "provider account"}
                      {batch.payout_account_number
                        ? ` · ${batch.payout_account_number}`
                        : ""}
                    </p>
                  )}
                  <p>
                    Complete the transfer first. Record it as paid only after
                    confirming the transfer or cash receipt.
                  </p>
                </>
              )}
              {batch.reference && <p>Reference: {batch.reference}</p>}
              {batch.status === "pending" ? (
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    const reference = String(
                      new FormData(event.currentTarget).get("reference") ?? "",
                    );
                    void submit(event, key, {
                      action: "mark-paid",
                      batchId: batch.id,
                      reference,
                    });
                  }}
                >
                  <label className={styles.field}>
                    Transfer reference or cash receipt number
                    <input
                      name="reference"
                      minLength={3}
                      maxLength={120}
                      required
                      disabled={busy === key}
                    />
                  </label>
                  {messages[key] && <p role="status">{messages[key]}</p>}
                  <Button
                    type="submit"
                    variant="primary"
                    loading={busy === key}
                    disabled={Boolean(busy)}
                  >
                    Mark batch paid
                  </Button>
                </form>
              ) : (
                <p>Paid {batch.paid_at ? new Date(batch.paid_at).toLocaleString() : ""}</p>
              )}
            </article>
          );
        })}
      </section>
    </>
  );
}
