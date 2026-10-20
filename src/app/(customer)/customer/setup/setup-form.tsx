"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { LocationPicker } from "@/components/location/location-picker";
import type { Coordinates } from "@/lib/location/coordinates";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { StatusMessage } from "@/components/ui/status-message";
import { PageHeading } from "@/components/layout/page-heading";
import { createClient } from "@/lib/supabase/browser";
import styles from "@/app/(public)/auth.module.css";
import layout from "./setup-form.module.css";

type LegalVersion = { id: string; doc_type: "terms" | "privacy"; version: string };
type SignupMetadata = {
  first_name?: string;
  last_name?: string;
  birthday?: string;
  mobile?: string;
  account_type?: "household" | "business";
  business_name?: string | null;
};

export function CustomerSetupForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<SignupMetadata>({});
  const [legal, setLegal] = useState<LegalVersion[]>([]);
  const [point, setPoint] = useState<Coordinates | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const [{ data: { user }, error: userError }, { data: versions, error: legalError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("legal_versions").select("id, doc_type, version, published_at")
          .in("doc_type", ["terms", "privacy"]).not("published_at", "is", null)
          .order("published_at", { ascending: false }),
      ]);
      if (!active) return;
      if (userError || !user) {
        setError("Your session is missing. Log in after confirming your email to finish setting up your customer account.");
        setLoading(false);
        return;
      }
      if (user.app_metadata?.role && user.app_metadata.role !== "customer") {
        setError("This setup page is for customer accounts. Log in with a customer account to continue.");
        setLoading(false);
        return;
      }
      if (legalError) setError("Could not load the current Terms and Privacy Notice. Refresh the page or try again.");
      else setLegal((versions ?? []) as LegalVersion[]);
      setMetadata(user.user_metadata as SignupMetadata);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  const terms = legal.find((version) => version.doc_type === "terms");
  const privacy = legal.find((version) => version.doc_type === "privacy");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    if (!termsAccepted || !privacyAccepted) {
      setError("Accept the Terms and Privacy Notice to continue.");
      return;
    }
    if (!terms || !privacy) {
      setError("Current Terms and Privacy Notice versions are unavailable. Contact the administrator before continuing.");
      return;
    }
    if (!point) {
      setError("Choose your service address on the map and select Use this location.");
      return;
    }

    const data = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Your session expired. Log in again to finish setting up your account.");
      const { data: addressId, error: onboardingError } = await supabase.rpc("complete_customer_onboarding", {
        p_first_name: String(data.get("first_name") ?? "").trim(),
        p_last_name: String(data.get("last_name") ?? "").trim(),
        p_birthday: String(data.get("birthday") ?? ""),
        p_mobile: String(data.get("mobile") ?? "").trim(),
        p_account_type: metadata.account_type === "business" ? "business" : "household",
        p_business_name: String(data.get("business_name") ?? "").trim(),
        p_line1: String(data.get("line1") ?? "").trim(),
        p_barangay: String(data.get("barangay") ?? "").trim(),
        p_city: String(data.get("city") ?? "").trim(),
        p_province: String(data.get("province") ?? "").trim(),
        p_landmark: String(data.get("landmark") ?? "").trim(),
        p_terms_version_id: terms.id,
        p_privacy_version_id: privacy.id,
        p_terms_accepted: termsAccepted,
        p_privacy_accepted: privacyAccepted,
        p_device: navigator.userAgent,
      });
      if (onboardingError || typeof addressId !== "string") throw onboardingError ?? new Error("Could not save the account details.");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session expired. Log in again to finish setting up your account.");
      const response = await fetch("/api/location/save", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ target: "address", recordId: addressId, ...point }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Account details were saved, but the map location was not. Try saving again.");
      window.location.assign("/customer");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not finish setting up your account.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className={layout.page}><PageHeading title="Finish setting up your account" description="Confirm your details, choose a service address, and record your consent." /><p role="status">Loading your account…</p></div>;

  return (
    <section className={layout.page}>
      <PageHeading title="Finish setting up your account" description="Confirm your details, choose a service address, and record your consent." />
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      {!error?.startsWith("Your session is missing") && <form className={styles.form} onSubmit={submit}>
        <Input label="First name" name="first_name" autoComplete="given-name" defaultValue={metadata.first_name ?? ""} required />
        <Input label="Last name" name="last_name" autoComplete="family-name" defaultValue={metadata.last_name ?? ""} required />
        <Input label="Date of birth" name="birthday" type="date" autoComplete="bday" defaultValue={metadata.birthday ?? ""} required />
        <Input label="Mobile number" name="mobile" type="tel" inputMode="tel" defaultValue={metadata.mobile ?? ""} required />
        {metadata.account_type === "business" && <Input label="Business name" name="business_name" autoComplete="organization" defaultValue={metadata.business_name ?? ""} required />}
        <Input label="Street address" name="line1" autoComplete="address-line1" required />
        <Input label="Barangay" name="barangay" autoComplete="address-level3" />
        <Input label="City or municipality" name="city" autoComplete="address-level2" required />
        <Input label="Province" name="province" autoComplete="address-level1" />
        <Input label="Landmark (optional)" name="landmark" />
        <LocationPicker onSaved={setPoint} />
        <p>Review the <Link href="/terms" target="_blank">Terms {terms ? `(version ${terms.version})` : ""}</Link> and <Link href="/privacy" target="_blank">Privacy Notice {privacy ? `(version ${privacy.version})` : ""}</Link>.</p>
        <Checkbox label="I accept the Terms." checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
        <Checkbox label="I have read the Privacy Notice." checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />
        <Button type="submit" variant="primary" loading={saving} disabled={saving || !terms || !privacy || !termsAccepted || !privacyAccepted || !point} disabledReason="Complete the required details, choose your map location, and accept both documents.">Save and continue</Button>
      </form>}
      {error?.startsWith("Your session is missing") && <p><Link href="/login">Log in to continue</Link></p>}
    </section>
  );
}
