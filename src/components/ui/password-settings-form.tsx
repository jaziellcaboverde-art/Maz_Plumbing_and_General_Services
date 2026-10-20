"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, ButtonGroup } from "./button";
import { Input } from "./input";
import { StatusMessage } from "./status-message";
import { createClient } from "@/lib/supabase/browser";
import styles from "@/app/(public)/auth.module.css";

export function PasswordSettingsForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ status: "success" | "error"; text: string } | null>(null);
  const mismatch = confirm !== "" && password !== confirm;
  const ready = currentPassword !== "" && password.length >= 8 && password === confirm;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { data: { user }, error: sessionError } = await supabase.auth.getUser();
      if (sessionError || !user) {
        setMessage({ status: "error", text: "Your sign-in session has expired. Log in again, then update your password." });
        return;
      }
      if (!user.email) {
        setMessage({ status: "error", text: "This account has no email address for password verification." });
        return;
      }
      const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (reauthError) {
        setMessage({ status: "error", text: reauthError.message.toLowerCase().includes("invalid login credentials")
          ? "The current password is incorrect. Try again."
          : `Could not verify your current password: ${reauthError.message}` });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const reason = error.message.toLowerCase();
        const text = reason.includes("same")
          ? "Choose a password different from your current password."
          : `Password update failed: ${error.message}`;
        setMessage({ status: "error", text });
        return;
      }
      setCurrentPassword("");
      setPassword("");
      setConfirm("");
      setMessage({ status: "success", text: "Your password has been updated." });
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "Unexpected error.";
      setMessage({ status: "error", text: `Could not update your password: ${detail}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={save} noValidate>
      <Input
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        required
      />
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        message={password !== "" && password.length < 8 ? "Use at least 8 characters." : undefined}
        status={password !== "" && password.length < 8 ? "error" : "default"}
        required
      />
      <Input
        label="Repeat new password"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        message={mismatch ? "The two passwords do not match." : undefined}
        status={mismatch ? "error" : "default"}
        required
      />
      {message && <StatusMessage status={message.status}>{message.text}</StatusMessage>}
      <ButtonGroup>
        <Button type="submit" variant="primary" loading={saving} disabled={!ready} disabledReason="Enter your current password, then enter the same new password twice (at least 8 characters).">
          Update password
        </Button>
      </ButtonGroup>
      <div className={styles.links}>
        <Link className={styles.link} href="/forgot-password">Forgot your current password?</Link>
      </div>
    </form>
  );
}
