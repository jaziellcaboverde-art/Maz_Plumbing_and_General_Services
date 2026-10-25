"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";

export function ProviderRequirementsForm({ initialNbiRequired }: { initialNbiRequired: boolean }) {
  const [required, setRequired] = useState(initialNbiRequired);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ status: "success" | "error"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/config/provider-requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nbiClearanceRequired: required }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save provider requirements.");
      setNotice({ status: "success", text: "Provider hiring requirement saved." });
    } catch (error) {
      setNotice({ status: "error", text: error instanceof Error ? error.message : "Could not save provider requirements." });
    } finally { setBusy(false); }
  }

  return <div>
    <label>
      <input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} />
      Require NBI clearance for provider applications
    </label>
    <p>{required ? "Applicants must upload an NBI clearance." : "NBI clearance will not be requested or stored."}</p>
    {notice && <StatusMessage status={notice.status}>{notice.text}</StatusMessage>}
    <Button type="button" variant="primary" loading={busy} disabled={busy} onClick={() => void save()}>Save requirement</Button>
  </div>;
}
