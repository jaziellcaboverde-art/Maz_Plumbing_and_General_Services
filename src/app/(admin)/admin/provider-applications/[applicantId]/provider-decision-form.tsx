"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusMessage } from "@/components/ui/status-message";

export function ProviderDecisionForm({ applicantId }: { applicantId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
  const [decisionSaved, setDecisionSaved] = useState(false);
  async function decide(event: FormEvent<HTMLFormElement>, decision: "approved" | "rejected") {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/admin/provider-applications/${applicantId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, message: String(data.get("message") ?? "").trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save the decision.");
      if (decision === "approved" && body.approvalEmailSent === false) {
        setDecisionSaved(true);
        setEmailWarning("The application was approved, but the acceptance email could not be sent. Ask the provider to use Forgot password, then check the email sender settings.");
        return;
      }
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the decision."); }
    finally { setBusy(false); }
  }
  return <form ref={formRef} onSubmit={(event) => decide(event, "rejected")}>
    <h2>Decision</h2>
    <Input label="Message to applicant" name="message" maxLength={1000} hint="Required for rejection. Included in their application status and notification." />
    {error && <StatusMessage status="error">{error}</StatusMessage>}
    {emailWarning && <StatusMessage status="warning">{emailWarning}</StatusMessage>}
    {emailWarning && <Button type="button" onClick={() => router.refresh()}>Refresh application status</Button>}
    <Button type="button" variant="primary" loading={busy} disabled={busy || decisionSaved} onClick={(event) => {
      event.preventDefault();
      if (formRef.current) void decide({ preventDefault() {}, currentTarget: formRef.current } as FormEvent<HTMLFormElement>, "approved");
    }}>Approve</Button>
    <Button type="submit" disabled={busy || decisionSaved}>Reject application</Button>
  </form>;
}
