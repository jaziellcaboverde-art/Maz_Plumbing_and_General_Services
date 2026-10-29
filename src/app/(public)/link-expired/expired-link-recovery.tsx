"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusMessage } from "@/components/ui/status-message";
import { createClient } from "@/lib/supabase/browser";
import styles from "../auth.module.css";

type LinkFlow = "provider-signup" | "customer-signup" | "password-reset";

function flowFromNext(next: string | null): LinkFlow {
  if (next === "/provider-application/submit" || next === "/auth/continue?intent=provider") {
    return "provider-signup";
  }
  if (next === "/customer/setup") return "customer-signup";
  return "password-reset";
}

const CONFIRM_NEXT: Record<Exclude<LinkFlow, "password-reset">, string> = {
  "provider-signup": "/auth/continue?intent=provider",
  "customer-signup": "/customer/setup",
};

export function ExpiredLinkRecovery() {
  const searchParams = useSearchParams();
  const flow = flowFromNext(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!address || loading) return;

    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const result = flow === "password-reset"
        ? await supabase.auth.resetPasswordForEmail(address, {
          redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
        })
        : await supabase.auth.resend({
          type: "signup",
          email: address,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(CONFIRM_NEXT[flow])}`,
          },
        });

      if (result.error) {
        setError("Could not request a new link. Try logging in if you have already confirmed your email.");
        return;
      }
      setSent(true);
    } catch (caught) {
      console.error("Could not request a replacement auth email:", caught);
      setError("Could not request a new link. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {sent ? (
        <StatusMessage status="success">
          If that email can receive a new link, it has been requested. Check your inbox and spam folder, and use only the newest email.
        </StatusMessage>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          {error && <StatusMessage status="error">{error}</StatusMessage>}
          <Button type="submit" variant="primary" loading={loading} disabled={!email.trim() || loading}>
            {flow === "password-reset" ? "Send a new reset link" : "Resend confirmation email"}
          </Button>
        </form>
      )}
      <div className={styles.links}>
        <Link className={styles.link} href="/login">Log in</Link>
        {flow !== "password-reset" && (
          <Link className={styles.link} href="/forgot-password">Forgot password?</Link>
        )}
      </div>
    </>
  );
}
