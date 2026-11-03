"use client";
import { GoogleButton } from "@/components/auth/google-button";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { HumanVerificationWidget, humanVerificationEnabled } from "@/components/auth/human-verification-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { isPhMobile, PHONE_ERROR } from "@/lib/phone";
import { isAdultBirthdate } from "@/lib/validation/birthdate";
import { Select } from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import { createClient } from "@/lib/supabase/browser";
import styles from "../auth.module.css";

export function CustomerSignupForm() {
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState("household");
  const [notice, setNotice] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const firstName = String(data.get("first_name") ?? "").trim();
    const lastName = String(data.get("last_name") ?? "").trim();
    const birthday = String(data.get("birthday") ?? "");
    const mobile = String(data.get("mobile") ?? "").trim();
    const businessName = String(data.get("business_name") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirm_password") ?? "");
    if (password.length < 8 || password.length > 72) {
      setError("Use a password of 8 to 72 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password and Confirm password must match.");
      return;
    }
    if (!isPhMobile(mobile)) {
      setError(PHONE_ERROR);
      return;
    }
    if (!isAdultBirthdate(birthday)) {
      setError("You must be at least 18 years old to create an account.");
      return;
    }
    if (accountType === "business" && !businessName) {
      setError("Enter your business name.");
      return;
    }

    if (humanVerificationEnabled && !captchaToken) {
      setError("Complete the check below, then create your account.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    setResendNotice(null);
    setConfirmationPending(false);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "customer",
          email: email.trim(),
          password,
          firstName,
          lastName,
          birthday,
          mobile,
          accountType,
          businessName,
          captchaToken,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        signedIn?: boolean;
        redirectTo?: string;
        reason?: string;
        message?: string;
      };
      if (result.reason === "captcha_failed")
        throw new Error("The check did not pass. Try it again.");
      if (!response.ok || !result.ok)
        throw new Error(
          result.message ??
            "Could not create your account. If Supabase is unavailable, run npm run auth:check.",
        );
      if (result.signedIn && result.redirectTo) {
        window.location.assign(result.redirectTo);
        return;
      }
      setEmail(email.trim());
      setConfirmationPending(true);
      setNotice(
        "Account created. Confirm your email, then finish your service address and consent details.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create your account.",
      );
    } finally {
      setBusy(false);
      setCaptchaReset((count) => count + 1);
    }
  }

  async function resendConfirmation() {
    if (!confirmationPending || resending) return;
    setResending(true);
    setResendNotice(null);
    setError(null);
    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/customer/setup`,
        },
      });
      if (resendError) throw resendError;
      setResendNotice(
        "If this signup is still awaiting confirmation, a new email was requested. Check your inbox and spam folder.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not resend the confirmation email.",
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <>
    <form className={styles.form} onSubmit={submit}>
      <Input label="First name" name="first_name" autoComplete="given-name" required />
      <Input label="Last name" name="last_name" autoComplete="family-name" required />
      <Input label="Date of birth" name="birthday" type="date" autoComplete="bday" required />
      <PhoneInput label="Mobile number" name="mobile" required />
      <Select label="Account type" name="account_type" value={accountType} onChange={(event) => setAccountType(event.target.value)}>
        <option value="household">Household</option>
        <option value="business">Business</option>
      </Select>
      {accountType === "business" && <Input label="Business name" name="business_name" autoComplete="organization" required />}
      <Input label="Email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <Input label="Password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} hint="Use 8 to 72 characters." required />
      <Input label="Confirm password" name="confirm_password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      {notice && <StatusMessage status="success">{notice}</StatusMessage>}
      {resendNotice && <StatusMessage status="info">{resendNotice}</StatusMessage>}
      {confirmationPending && <Button type="button" variant="secondary" loading={resending} disabled={resending} onClick={resendConfirmation}>Resend confirmation email</Button>}
      <HumanVerificationWidget onToken={setCaptchaToken} resetSignal={captchaReset} />
      <Button type="submit" variant="primary" loading={busy} disabled={busy}>Create account</Button>
      <p className={styles.links}><Link href="/terms" target="_blank" rel="noopener noreferrer">Terms</Link> · <Link href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</Link></p>
    </form>
    <div className={styles.divider} role="separator"><span>or</span></div>
    <GoogleButton label="Sign up with Google" />
    <div className={styles.cardFooter}>
      <span>Already have an account? <Link href="/login">Log in</Link></span>
    </div>
    </>
  );
}
