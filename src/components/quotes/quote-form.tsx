"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { StatusMessage } from "@/components/ui/status-message";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/matching/client";
import {
  TIER_LABELS, checkMilestones, checkQuoteAmount, depositFor, formatPeso, milestoneTarget, paymentTierFor, paymentPlanText,
  type TierConfig,
} from "@/lib/quotes/rules";
import styles from "./quotes.module.css";

type Row = { title: string; amount: string };

/** Steps 9.3 and 9.7: price, class, what it covers, and milestones when the job turns out to be large. */
export function QuoteForm({ bookingId, config, lockedMajor, initialClass }: {
  bookingId: string; config: TierConfig; lockedMajor: boolean; initialClass: "minor" | "major";
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [jobClass, setJobClass] = useState<"minor" | "major">(lockedMajor ? "major" : initialClass);
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([{ title: "", amount: "" }, { title: "", amount: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = Number(amount);
  const amountError = amount === "" ? "Enter a price." : checkQuoteAmount(value);
  const tier = amountError ? null : paymentTierFor(value, jobClass === "major", config);
  const items = useMemo(() => rows.map((r) => ({ title: r.title, amount: Number(r.amount) })), [rows]);
  const milestoneError = tier === "large" ? checkMilestones(items, value, config) : null;
  const notesShort = notes.trim().length < 10;
  const blocked = !!amountError || notesShort || !!milestoneError;

  function setRow(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (blocked || busy) return;
    setBusy(true); setError(null);
    const message = await postJson(`/api/bookings/${bookingId}/quote`, {
      amount: value, jobClass, notes, milestones: tier === "large" ? items : [],
    });
    setBusy(false);
    if (message) { setError(message); return; }
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <Input label="Price in pesos" type="number" inputMode="decimal" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
        hint="The total the customer pays for the whole job." />
      <RadioGroup legend="Job class" name="job-class" value={jobClass} onChange={(v) => setJobClass(v as "minor" | "major")} disabled={lockedMajor}
        options={[
          { value: "minor", label: "Minor", hint: "A short job you can finish quickly." },
          { value: "major", label: "Major", hint: lockedMajor ? "This job is already marked large." : "A bigger job. An admin checks this." },
        ]} />
      <Textarea label="What the price covers" hint="Work, materials, anything left out. At least 10 characters." value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />

      {tier && (
        <div className={`${styles.card} ${styles.highlight}`}>
          <span className={styles.tag}>{TIER_LABELS[tier]}</span>
          <span>{paymentPlanText(value, tier, config)}</span>
          {tier === "large" && <span className={styles.muted}>Split the milestone share ({formatPeso(milestoneTarget(value, config))}) into {config.milestoneMin} to {config.milestoneMax} steps below.</span>}
        </div>
      )}

      {tier === "large" && (
        <div className={styles.stack}>
          <h3 className={styles.heading}>Milestones</h3>
          {rows.map((row, index) => (
            <div key={index} className={styles.milestoneRow}>
              <Input label={`Milestone ${index + 1} title`} value={row.title} maxLength={120} onChange={(e) => setRow(index, { title: e.target.value })} />
              <Input label="Amount in pesos" type="number" inputMode="decimal" min={1} step="0.01" value={row.amount} onChange={(e) => setRow(index, { amount: e.target.value })} />
              {rows.length > config.milestoneMin && <Button type="button" onClick={() => setRows((c) => c.filter((_, i) => i !== index))}>Remove milestone {index + 1}</Button>}
            </div>
          ))}
          {rows.length < config.milestoneMax && <Button type="button" onClick={() => setRows((c) => [...c, { title: "", amount: "" }])}>Add a milestone</Button>}
          {milestoneError && <StatusMessage status="warning">{milestoneError}</StatusMessage>}
        </div>
      )}

      <Button type="submit" variant="primary" loading={busy} disabled={busy || blocked}
        disabledReason={amountError ?? (notesShort ? "Say what the price covers." : milestoneError ?? undefined)}>
        Send quote for approval{tier ? ` (deposit ${formatPeso(depositFor(value, tier, config))})` : ""}
      </Button>
    </form>
  );
}
