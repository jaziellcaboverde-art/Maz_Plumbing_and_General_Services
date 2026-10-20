"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusMessage } from "@/components/ui/status-message";
import { createClient } from "@/lib/supabase/browser";
import styles from "../auth.module.css";

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    // Read from the form itself so browser/password-manager autofill works even
    // when the browser does not dispatch React change events for filled fields.
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);
    setError(null);
    setConfirmationPending(false);
    setResendNotice(null);
    try {
      const requestedPath = new URLSearchParams(window.location.search).get("next") ?? undefined;
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next: requestedPath }),
      });
      const result = await response.json() as { ok?: boolean; reason?: string; redirectTo?: string };
      if (result.reason === "email_not_confirmed") {
        setError("Confirm your email using the link we sent before logging in. Check your inbox and spam folder.");
        setConfirmationEmail(email);
        setConfirmationPending(true);
        return;
      }
      if (!response.ok && result.reason === "invalid_credentials") {
        // One message for both cases, so it does not reveal which emails have accounts.
        setError("The email or password is wrong. Check both and try again.");
        return;
      }
      if (!response.ok || !result.ok || !result.redirectTo) {
        setError("Could not reach the sign-in service. Check your connection and try again.");
        return;
      }
      window.location.assign(result.redirectTo);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setError(/fetch failed|failed to fetch|network/i.test(message)
        ? "Could not reach the sign-in service. Check your connection and try again."
        : message || "Could not log in. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    if (!confirmationPending || !confirmationEmail || resending) return;
    setResending(true);
    setError(null);
    setResendNotice(null);
    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: confirmationEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      if (resendError) throw resendError;
      setResendNotice("If this account is awaiting confirmation, a fresh email was requested. Check your inbox and spam folder.");
    } catch {
      setError("Could not resend the confirmation email. Wait a moment and try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <form className={`${styles.form} ${styles.loginForm}`} method="post" onSubmit={onSubmit} noValidate>
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      {resendNotice && <StatusMessage status="success">{resendNotice}</StatusMessage>}
      {confirmationPending && (
        <Button type="button" variant="secondary" loading={resending} disabled={resending} onClick={resendConfirmation}>
          Resend confirmation email
        </Button>
      )}
      <ButtonGroup>
        <Button
          id="login-submit"
          type="submit"
          variant="primary"
          loading={loading}
          disabled={loading}
        >
          Log in
        </Button>
      </ButtonGroup>
      <div className={styles.loginLinks}>
        <Link className={styles.forgotLink} href="/forgot-password">
          Forgot password?
        </Link>
        <section className={styles.guestSignup} aria-labelledby="guest-signup-title">
          <h2 id="guest-signup-title" className={styles.guestSignupTitle}>New to MAZ? Choose an account type</h2>
          <div className={styles.guestSignupActions}>
            <Link className={styles.guestSignupButton} href="/apply/provider">
              Apply to become a provider
            </Link>
            <Link className={`${styles.guestSignupButton} ${styles.guestSignupPrimary}`} href="/signup">
              Create a customer account
            </Link>
          </div>
        </section>
      </div>
    </form>
  );
}
