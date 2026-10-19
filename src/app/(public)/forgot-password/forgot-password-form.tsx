"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusMessage } from "@/components/ui/status-message";
import { createClient } from "@/lib/supabase/browser";
import styles from "../auth.module.css";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = email.trim() !== "";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || loading) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      // Supabase's default email template sends the user back to this callback
      // with a PKCE code; the callback then establishes the recovery session.
      const redirectTo = new URL("/auth/confirm?next=/reset-password", window.location.origin).toString();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (resetError) {
        setError("Could not send the email. Wait a minute and try again.");
        return;
      }
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the email. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className={styles.form}>
        {/* Same words whether or not the email has an account. */}
        <StatusMessage status="success">If that email has an account, a reset link is on its way.</StatusMessage>
        <div className={styles.links}>
          <Link className={styles.link} href="/login">
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <ButtonGroup>
        <Button
          id="forgot-submit"
          type="submit"
          variant="primary"
          loading={loading}
          disabled={!ready}
          disabledReason="Enter your email."
        >
          Send reset link
        </Button>
      </ButtonGroup>
      <div className={styles.links}>
        <Link className={styles.link} href="/login">
          Back to log in
        </Link>
      </div>
    </form>
  );
}
