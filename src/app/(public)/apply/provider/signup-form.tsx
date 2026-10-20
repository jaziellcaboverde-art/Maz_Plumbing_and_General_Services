"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusMessage } from "@/components/ui/status-message";
import { createClient } from "@/lib/supabase/browser";
import styles from "../../auth.module.css";

export function ProviderSignupForm() {
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const firstName = String(data.get("first_name") ?? "").trim();
    const lastName = String(data.get("last_name") ?? "").trim();
    const birthday = String(data.get("birthday") ?? "");
    const mobile = String(data.get("mobile") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!/^\+639\d{9}$/.test(mobile)) {
      setError("Enter a Philippine mobile number in +639XXXXXXXXX format.");
      return;
    }
    const ageDate = new Date(`${birthday}T00:00:00`);
    const adultDate = new Date(ageDate);
    adultDate.setFullYear(adultDate.getFullYear() + 18);
    if (!birthday || Number.isNaN(ageDate.valueOf()) || adultDate > new Date()) {
      setError("Applicants must be at least 18 years old.");
      return;
    }
    setBusy(true); setError(null); setNotice(null);
    setResendNotice(null); setConfirmationPending(false);
    try {
      const supabase = createClient();
      const { data: result, error: signUpError } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/provider-application/submit`,
          data: { first_name: firstName, last_name: lastName, birthday, mobile },
        },
      });
      if (signUpError) throw signUpError;
      if (result.session) {
        window.location.assign("/provider-application/submit");
        return;
      }
      setEmail(email);
      setConfirmationPending(true);
      setNotice("Check your email and confirm your account. Then return here to finish your provider application.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create your account.");
    } finally { setBusy(false); }
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
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/provider-application/submit`,
        },
      });
      if (resendError) throw resendError;
      setResendNotice("If this signup is still awaiting confirmation, a new email was requested. Check your inbox and spam folder.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resend the confirmation email.");
    } finally {
      setResending(false);
    }
  }

  return <form className={styles.form} onSubmit={submit}>
    <Input label="First name" name="first_name" autoComplete="given-name" required />
    <Input label="Last name" name="last_name" autoComplete="family-name" required />
    <Input label="Date of birth" name="birthday" type="date" required />
    <Input label="Mobile number" name="mobile" type="tel" inputMode="tel" placeholder="+639XXXXXXXXX" hint="Philippine mobile numbers only for this launch." required />
    <Input label="Email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
    <Input label="Password" name="password" type="password" autoComplete="new-password" minLength={8} required />
    {error && <StatusMessage status="error">{error}</StatusMessage>}
    {notice && <StatusMessage status="success">{notice} <Link href="/provider-application/submit">Continue application</Link></StatusMessage>}
    {resendNotice && <StatusMessage status="info">{resendNotice}</StatusMessage>}
    {confirmationPending && <Button type="button" variant="secondary" loading={resending} disabled={resending} onClick={resendConfirmation}>Resend confirmation email</Button>}
    <Button type="submit" variant="primary" loading={busy} disabled={busy}>Create account</Button>
  </form>;
}
