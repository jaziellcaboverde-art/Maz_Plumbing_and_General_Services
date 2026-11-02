"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { createClient } from "@/lib/supabase/browser";

export function ApprovedSession() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true); setError(null);
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) { setError("Could not sign out. Close the tab and sign in again after reopening the site."); setBusy(false); return; }
    window.location.assign("/login");
  }
  return <div>
    <StatusMessage status="success">Your provider application is approved. Sign out and log in again to refresh your provider access.</StatusMessage>
    {error && <StatusMessage status="error">{error}</StatusMessage>}
    <Button variant="primary" onClick={signOut} loading={busy} disabled={busy}>Sign out and continue</Button>
  </div>;
}
