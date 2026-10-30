"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonGroup } from "./button";
import { Modal } from "./modal";
import { createClient } from "@/lib/supabase/browser";
import { LogOut } from "lucide-react";
import styles from "./logout-button.module.css";

export function LogoutButton() {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logOut() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Could not log out. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button className={styles.iconButton} type="button" aria-label="Log out" title="Log out" onClick={() => { setError(null); setConfirmOpen(true); }}>
        <LogOut aria-hidden="true" />
      </button>
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Log out?"
        error={error ?? undefined}
        footer={
          <ButtonGroup>
            <Button type="button" variant="primary" onClick={logOut} loading={busy} disabled={busy}>Log out</Button>
            <Button type="button" onClick={() => setConfirmOpen(false)} disabled={busy}>Cancel</Button>
          </ButtonGroup>
        }
      >
        <p>Are you sure you want to log out?</p>
      </Modal>
    </div>
  );
}
