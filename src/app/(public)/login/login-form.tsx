"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusMessage } from "@/components/ui/status-message";
import { isRole, roleHome } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/browser";
import styles from "../auth.module.css";

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError || !data.user) {
        // One message for both cases, so it does not reveal which emails have accounts.
        setError("The email or password is wrong. Check both and try again.");
        return;
      }
      const role = data.user.app_metadata?.role;
      // A full navigation lets the Next.js proxy read the session cookies just
      // written by Supabase before it checks access to the provider area.
      window.location.assign(roleHome(isRole(role) ? role : "customer"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not log in. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} method="post" onSubmit={onSubmit} noValidate>
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
      <div className={styles.links}>
        <Link className={styles.link} href="/forgot-password">
          Forgot password
        </Link>
      </div>
    </form>
  );
}
