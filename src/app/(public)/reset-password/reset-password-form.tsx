"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusMessage } from "@/components/ui/status-message";
import { createClient } from "@/lib/supabase/browser";
import styles from "../auth.module.css";

const MIN_LENGTH = 8;

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = password !== "" && password.length < MIN_LENGTH;
  const mismatch = confirm !== "" && password !== confirm;
  const ready = password.length >= MIN_LENGTH && password === confirm;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || loading) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("Could not save the new password. Open the link in your email again and retry.");
        return;
      }
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the new password. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className={styles.form}>
        <StatusMessage status="success">Your password is saved.</StatusMessage>
        <div className={styles.links}>
          <Link className={styles.link} href="/login">
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        status={tooShort ? "error" : "default"}
        message={tooShort ? `Use at least ${MIN_LENGTH} characters.` : undefined}
        required
      />
      <Input
        label="Repeat new password"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        status={mismatch ? "error" : "default"}
        message={mismatch ? "The two passwords do not match." : undefined}
        required
      />
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <ButtonGroup>
        <Button
          id="reset-submit"
          type="submit"
          variant="primary"
          loading={loading}
          disabled={!ready}
          disabledReason={`Enter the same password twice, at least ${MIN_LENGTH} characters.`}
        >
          Save password
        </Button>
      </ButtonGroup>
    </form>
  );
}
