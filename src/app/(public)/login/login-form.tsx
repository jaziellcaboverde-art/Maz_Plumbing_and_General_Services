"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { HumanVerificationWidget, humanVerificationEnabled } from "@/components/auth/human-verification-widget";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

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

    if (humanVerificationEnabled && !captchaToken) {
      setError("Complete the check below, then log in.");
      return;
    }

    setLoading(true);
    setError(null);
    setConfirmationPending(false);
    setResendNotice(null);
    try {
      const requestedPath =
        new URLSearchParams(window.location.search).get("next") ?? undefined;
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          next: requestedPath,
          captchaToken,
          remember: formData.get("remember") === "on",
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        reason?: string;
        redirectTo?: string;
      } | null;
      if (result?.reason === "setup_required") {
        setError(
          "Login is not set up yet. Add your Supabase Project URL and publishable/anon key to .env.local, restart npm run dev, then run npm run auth:check.",
        );
        return;
      }
      if (result?.reason === "invalid_configuration") {
        setError(
          "The Supabase URL or API key is invalid. Check .env.local against your Supabase dashboard, restart the server, and run npm run auth:check.",
        );
        return;
      }
      if (result?.reason === "connection_failed") {
        setError(
          "The website server cannot connect to Supabase. Verify the project is running and check the URL and network with npm run auth:check.",
        );
        return;
      }
      if (result?.reason === "service_unavailable") {
        setError(
          "The sign-in service is temporarily unavailable. Run npm run auth:check and check the npm run dev terminal for details.",
        );
        return;
      }
      if (result?.reason === "rate_limited") {
        setError(
          "Too many login attempts. Wait a few minutes before trying again.",
        );
        return;
      }
      if (result?.reason === "captcha_failed") {
        setError("The check did not pass. Try it again.");
        return;
      }
      if (result?.reason === "email_not_confirmed") {
        setError(
          "Confirm your email using the link we sent before logging in. Check your inbox and spam folder.",
        );
        setConfirmationEmail(email);
        setConfirmationPending(true);
        return;
      }
      if (!response.ok && result?.reason === "invalid_credentials") {
        // One message for both cases, so it does not reveal which emails have accounts.
        setError("The email or password is wrong. Check both and try again.");
        return;
      }
      if (!response.ok || !result?.ok || !result.redirectTo) {
        setError(
          "Could not complete login. Check the npm run dev terminal and run npm run auth:check.",
        );
        return;
      }
      window.location.assign(result.redirectTo);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setError(
        /fetch failed|failed to fetch|network/i.test(message)
          ? "Could not contact the website server. Make sure npm run dev is running and reload the page."
          : "Could not complete login. Check the npm run dev terminal for details.",
      );
    } finally {
      setLoading(false);
      // Verification tokens are single-use, so ask for a new one after every attempt that did not leave the page.
      setCaptchaReset((count) => count + 1);
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
      setResendNotice(
        "If this account is awaiting confirmation, a fresh email was requested. Check your inbox and spam folder.",
      );
    } catch {
      setError(
        "Could not resend the confirmation email. Wait a moment and try again.",
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <form
        className={styles.form}
        method="post"
        onSubmit={onSubmit}
        noValidate
      >
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <div className={styles.optionsRow}>
          <Checkbox label="Remember me" name="remember" />
          <Link className={styles.link} href="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <HumanVerificationWidget onToken={setCaptchaToken} resetSignal={captchaReset} />
        {error && <StatusMessage status="error">{error}</StatusMessage>}
        {resendNotice && (
          <StatusMessage status="success">{resendNotice}</StatusMessage>
        )}
        {confirmationPending && (
          <Button
            type="button"
            variant="secondary"
            loading={resending}
            disabled={resending}
            onClick={resendConfirmation}
          >
            Resend confirmation email
          </Button>
        )}
        <Button
          id="login-submit"
          type="submit"
          variant="primary"
          loading={loading}
          disabled={loading}
        >
          Log in
        </Button>
      </form>
      <div className={styles.cardFooter}>
        <span>
          New customer? <Link href="/signup">Create an account</Link>
        </span>
        <span>
          Want to work with us?{" "}
          <Link href="/apply/provider">Apply as a provider</Link>
        </span>
      </div>
    </>
  );
}
