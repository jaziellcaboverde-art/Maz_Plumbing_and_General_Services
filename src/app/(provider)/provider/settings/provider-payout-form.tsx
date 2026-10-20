"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";

export function ProviderPayoutForm({ initialMethod, initialAccountName, initialAccountNumber }: {
  initialMethod: string;
  initialAccountName: string;
  initialAccountNumber: string;
}) {
  const [method, setMethod] = useState(initialMethod);
  const [accountName, setAccountName] = useState(initialAccountName);
  const [accountNumber, setAccountNumber] = useState(initialAccountNumber);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ status: "success" | "error"; text: string } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/provider/settings/payout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, accountName, accountNumber }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save payout details.");
      setNotice({ status: "success", text: "Payout details saved." });
    } catch (error) {
      setNotice({ status: "error", text: error instanceof Error ? error.message : "Could not save payout details." });
    } finally { setBusy(false); }
  }

  return <form onSubmit={save}>
    <Select label="Payout method" value={method} onChange={(event) => setMethod(event.target.value)} required>
      <option value="" disabled>Choose a payout method</option>
      <option value="gcash">GCash</option>
      <option value="bank">Bank transfer</option>
      <option value="cash">Cash</option>
    </Select>
    {method !== "cash" && <>
      <Input label="Payout account name" autoComplete="name" maxLength={120} value={accountName} onChange={(event) => setAccountName(event.target.value)} required />
      <Input label="Payout account number" autoComplete="off" maxLength={80} value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} required />
    </>}
    {notice && <StatusMessage status={notice.status}>{notice.text}</StatusMessage>}
    <Button type="submit" variant="primary" loading={busy} disabled={busy}>Save payout details</Button>
  </form>;
}
