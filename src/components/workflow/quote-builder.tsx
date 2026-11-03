"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/matching/client";
import { manilaInputToISO } from "@/lib/provider/time";
import { peso } from "@/lib/matching/format";
import styles from "./workflow.module.css";
export function QuoteBuilder({
  bookingId,
  milestones,
}: {
  bookingId: string;
  milestones: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [items, setItems] = useState([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [schedule, setSchedule] = useState<
    { label: string; amount: number; dueAt: string; milestoneId: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const total = items.reduce(
    (sum, i) => sum + Math.round(i.quantity * i.unitPrice * 100) / 100,
    0,
  );
  return (
    <form
      className={styles.form}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const f = new FormData(e.currentTarget);
        setBusy(true);
        const error = await postJson(`/api/workflow/${bookingId}`, {
          action: "admin_quote",
          data: {
            items,
            schedule: schedule.map((i) => ({
              ...i,
              dueAt: i.dueAt ? manilaInputToISO(i.dueAt) : null,
              milestoneId: i.milestoneId || null,
            })),
            deposit: Number(f.get("deposit")),
            gatewayFee: Number(f.get("fee")),
            note: f.get("scope"),
            expiresAt: manilaInputToISO(String(f.get("expiry"))),
          },
        });
        setMessage(
          error ?? "Versioned quotation issued for customer approval.",
        );
        setBusy(false);
        if (!error) router.refresh();
      }}
    >
      <h3>Line items</h3>
      {items.map((item, index) => (
        <fieldset className={styles.card} key={index}>
          <legend>Item {index + 1}</legend>
          <label>
            Description
            <input
              required
              minLength={3}
              maxLength={300}
              value={item.description}
              onChange={(e) =>
                setItems(
                  items.map((i, n) =>
                    n === index ? { ...i, description: e.target.value } : i,
                  ),
                )
              }
            />
          </label>
          <div className={styles.grid}>
            <label>
              Quantity
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={item.quantity}
                onChange={(e) =>
                  setItems(
                    items.map((i, n) =>
                      n === index
                        ? { ...i, quantity: Number(e.target.value) }
                        : i,
                    ),
                  )
                }
              />
            </label>
            <label>
              Unit price (PHP)
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={item.unitPrice}
                onChange={(e) =>
                  setItems(
                    items.map((i, n) =>
                      n === index
                        ? { ...i, unitPrice: Number(e.target.value) }
                        : i,
                    ),
                  )
                }
              />
            </label>
          </div>
          {items.length > 1 && (
            <Button
              type="button"
              onClick={() => setItems(items.filter((_, n) => n !== index))}
            >
              Remove item {index + 1}
            </Button>
          )}
        </fieldset>
      ))}
      <Button
        type="button"
        disabled={items.length >= 30}
        onClick={() =>
          setItems([...items, { description: "", quantity: 1, unitPrice: 0 }])
        }
      >
        Add line item
      </Button>
      <strong>Gross service total: {peso(total)}</strong>
      <label>
        Scope, inclusions, exclusions and estimated duration
        <textarea name="scope" minLength={10} maxLength={4000} required />
      </label>
      <label>
        Required payment before execution (PHP)
        <input
          name="deposit"
          type="number"
          min="0"
          max={total}
          step="0.01"
          defaultValue="0"
          required
        />
      </label>
      <p>
        Choose the requirement for this project. Use 50% only for projects where
        MAZ requires it. Previous verified inspection payments count toward this
        amount.
      </p>
      <label>
        Disclosed processing fee per gateway checkout (PHP)
        <input
          name="fee"
          type="number"
          min="0"
          step="0.01"
          defaultValue="0"
          required
        />
      </label>
      <label>
        Quote valid until (Philippine time)
        <input name="expiry" type="datetime-local" required />
      </label>
      <h3>Additional agreed installments</h3>
      {schedule.map((i, index) => (
        <fieldset key={index} className={styles.card}>
          <legend>Installment {index + 1}</legend>
          <label>
            Label
            <input
              value={i.label}
              minLength={3}
              required
              onChange={(e) =>
                setSchedule(
                  schedule.map((s, n) =>
                    n === index ? { ...s, label: e.target.value } : s,
                  ),
                )
              }
            />
          </label>
          <label>
            Amount (PHP)
            <input
              type="number"
              min="1"
              step="0.01"
              value={i.amount}
              required
              onChange={(e) =>
                setSchedule(
                  schedule.map((s, n) =>
                    n === index ? { ...s, amount: Number(e.target.value) } : s,
                  ),
                )
              }
            />
          </label>
          <label>
            Due date (Philippine time)
            <input
              type="datetime-local"
              value={i.dueAt}
              required={!i.milestoneId}
              onChange={(e) =>
                setSchedule(
                  schedule.map((s, n) =>
                    n === index ? { ...s, dueAt: e.target.value } : s,
                  ),
                )
              }
            />
          </label>
          <label>
            Approved milestone trigger (optional)
            <select
              value={i.milestoneId}
              onChange={(e) =>
                setSchedule(
                  schedule.map((s, n) =>
                    n === index ? { ...s, milestoneId: e.target.value } : s,
                  ),
                )
              }
            >
              <option value="">Date only</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            onClick={() => setSchedule(schedule.filter((_, n) => n !== index))}
          >
            Remove installment
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        disabled={schedule.length >= 20}
        onClick={() =>
          setSchedule([
            ...schedule,
            { label: "", amount: 0, dueAt: "", milestoneId: "" },
          ])
        }
      >
        Add installment
      </Button>
      <p>
        The deposit plus installments cannot exceed the total. Any remaining
        balance is payable after MAZ sign-off.
      </p>
      {message && <p role="status">{message}</p>}
      <Button type="submit" disabled={busy || total <= 0} loading={busy}>
        Issue quotation version
      </Button>
    </form>
  );
}
