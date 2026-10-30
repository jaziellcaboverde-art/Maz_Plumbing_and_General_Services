"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";
import { TurnstileWidget, turnstileEnabled } from "@/components/auth/turnstile-widget";
import { LocationPicker } from "@/components/location/location-picker";
import { ProviderDocumentsDialog, requiredUploaded, type ProviderFiles } from "@/components/provider/provider-documents-dialog";
import { ProviderRequirements } from "@/components/provider/provider-requirements";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { StatusMessage } from "@/components/ui/status-message";
import type { Coordinates } from "@/lib/location/coordinates";
import { METRO_MANILA_AREAS } from "@/lib/location/metro-manila";
import { isPhMobile, PHONE_ERROR } from "@/lib/phone";
import { APPLICATION_MAX_BYTES, DOCUMENT_MAX_BYTES, DOCUMENT_SLOTS, formatBytes, resolveMime, slotFor, type DocumentKind } from "@/lib/provider/documents";
import type { ApplyService } from "@/lib/provider/load-apply-services";
import { ApplicationSubmitted, type ApplicationSummary } from "./application-submitted";
import authStyles from "../../auth.module.css";
import styles from "./apply-flow.module.css";

const PROOF_SLOT = slotFor("government_id");

/** The whole provider application on one page: details, documents, services, then Apply. */
export function ProviderApplyFlow({ services }: { services: readonly ApplyService[] }) {
  const [files, setFiles] = useState<ProviderFiles>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [proofs, setProofs] = useState<Record<string, File[]>>({});
  const [proofErrors, setProofErrors] = useState<Record<string, string | undefined>>({});
  const [baseLocation, setBaseLocation] = useState<(Coordinates & { address: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [summary, setSummary] = useState<ApplicationSummary | null>(null);

  const progress = requiredUploaded(files);
  const uploadedCount = DOCUMENT_SLOTS.filter((slot) => files[slot.kind]).length;

  function setFile(kind: DocumentKind, file: File | undefined) {
    setFiles((current) => ({ ...current, [kind]: file }));
  }

  function pickProofs(serviceId: string, list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (picked.length > 3) {
      setProofErrors((current) => ({ ...current, [serviceId]: "Choose up to 3 files." }));
      return;
    }
    const bad = picked.find((file) => !PROOF_SLOT || !resolveMime(file) || !PROOF_SLOT.types.includes(resolveMime(file) ?? "") || file.size <= 0 || file.size > DOCUMENT_MAX_BYTES);
    if (bad) {
      setProofErrors((current) => ({ ...current, [serviceId]: `${bad.name}: use PDF, DOC, DOCX, PNG, JPG or WebP, up to ${formatBytes(DOCUMENT_MAX_BYTES)} each.` }));
      return;
    }
    setProofErrors((current) => ({ ...current, [serviceId]: undefined }));
    // Store the real type so the server accepts Word files that the browser left untyped.
    setProofs((current) => ({ ...current, [serviceId]: picked.map((file) => (file.type === resolveMime(file) ? file : new File([file], file.name, { type: resolveMime(file) ?? file.type }))) }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const mobile = String(form.get("account_mobile") ?? "").trim();
    const birthday = String(form.get("account_birthday") ?? "");
    const selectedAreas = form.getAll("service_areas").map(String);
    const selected = chosen;

    if (!isPhMobile(mobile)) return setError(PHONE_ERROR);
    const born = new Date(`${birthday}T00:00:00`);
    const adult = new Date(born);
    adult.setFullYear(adult.getFullYear() + 18);
    if (!birthday || Number.isNaN(born.valueOf()) || adult > new Date()) return setError("Applicants must be at least 18 years old.");
    if (progress.missing.length) return setError(`Upload the required documents first: ${progress.missing.join(", ")}.`);
    if (!selectedAreas.length) return setError("Select at least one Metro Manila area you serve.");
    if (!baseLocation) return setError("Choose your base location on the map, then select Use this location.");
    if (!selected.length) return setError("Choose at least one service.");
    for (const id of selected) {
      const name = services.find((service) => service.id === id)?.name ?? "a service";
      if ((proofs[id] ?? []).length < 1) return setError(`Add proof for ${name}: a certificate or up to 3 photos of your past work.`);
    }
    if (turnstileEnabled && !captchaToken) return setError("Complete the check below, then apply.");

    let total = 0;
    for (const slot of DOCUMENT_SLOTS) {
      const file = files[slot.kind];
      if (file) { form.set(slot.kind, file); total += file.size; }
    }
    selected.forEach((id) => (proofs[id] ?? []).forEach((file) => { form.append(`proof_${id}`, file); total += file.size; }));
    if (total > APPLICATION_MAX_BYTES - 1024 * 1024) {
      return setError("The files are too large to send together. Remove a file or choose smaller ones.");
    }
    form.set("latitude", String(baseLocation.latitude));
    form.set("longitude", String(baseLocation.longitude));
    form.set("base_address", baseLocation.address);
    if (captchaToken) form.set("captchaToken", captchaToken);

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/provider-applications/apply", { method: "POST", body: form });
      const result = await response.json().catch(() => null) as { ok?: boolean; reference?: string; message?: string } | null;
      if (!response.ok || !result?.ok) throw new Error(result?.message ?? "Could not send your application. Try again.");
      setSummary({
        reference: result.reference ?? "",
        name: `${String(form.get("account_first_name") ?? "").trim()} ${String(form.get("account_last_name") ?? "").trim()}`.trim(),
        email: String(form.get("email") ?? "").trim(),
        mobile,
        areas: selectedAreas,
        services: selected.map((id) => services.find((service) => service.id === id)?.name ?? id),
        documents: DOCUMENT_SLOTS.filter((slot) => files[slot.kind]).map((slot) => slot.label),
      });
      window.scrollTo({ top: 0 });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send your application. Try again.");
    } finally {
      setBusy(false);
      setCaptchaReset((count) => count + 1);
    }
  }

  if (summary) return <ApplicationSubmitted summary={summary} />;

  const uploadStatus = progress.missing.length
    ? `${progress.done} of ${progress.total} required documents uploaded`
    : `All required documents uploaded (${uploadedCount} file${uploadedCount === 1 ? "" : "s"})`;

  return <>
    <h1 className={authStyles.cardTitle}>Apply as a provider</h1>
    <p className={authStyles.cardIntro}>Fill in your details, upload your documents and apply. An admin reviews your application and we email you the result.</p>

    <form className={authStyles.form} onSubmit={submit}>
      <fieldset className={styles.section}>
        <legend>Your account</legend>
        <div className={authStyles.fieldPair}>
          <Input label="First name" name="account_first_name" autoComplete="given-name" required />
          <Input label="Last name" name="account_last_name" autoComplete="family-name" required />
        </div>
        <div className={authStyles.fieldPair}>
          <Input label="Date of birth" name="account_birthday" type="date" autoComplete="bday" required />
          <PhoneInput label="Mobile number" name="account_mobile" required />
        </div>
        <Input label="Email" name="email" type="email" autoComplete="email" required />
        <Input label="Password" name="password" type="password" autoComplete="new-password" minLength={8} hint="At least 8 characters." required />
      </fieldset>

      <ProviderRequirements
        headingLevel={3}
        action={<>
          <Button onClick={() => setDialogOpen(true)}>Upload documents</Button>
          <p className={styles.uploadStatus} role="status">{uploadStatus}</p>
        </>}
      />

      <fieldset className={styles.section}>
        <legend>Metro Manila areas you serve</legend>
        <p className={styles.note}>Select every city or municipality where you can take jobs. The admin will check your base location during review.</p>
        <div className={styles.areaGrid}>
          {METRO_MANILA_AREAS.map((area) => <Checkbox key={area} name="service_areas" value={area} label={area} />)}
        </div>
      </fieldset>

      <Input label="Expected daily rate (PHP)" name="daily_rate" type="number" min="0" step="0.01" required />
      <LocationPicker onSaved={(point, address) => address && setBaseLocation({ ...point, address })} />
      {baseLocation && <StatusMessage status="success">Base location: {baseLocation.address}</StatusMessage>}

      <fieldset className={styles.section}>
        <legend>Emergency contact</legend>
        <div className={authStyles.fieldPair}>
          <Input label="Emergency contact name" name="emergency_contact_name" maxLength={120} required />
          <PhoneInput label="Emergency contact mobile" name="emergency_contact_phone" required />
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Experience and references</legend>
        <p className={styles.note}>Admins may call your references. Use people who have seen your work, not family.</p>
        <Input label="Years of experience in this trade" name="years_experience" type="number" min="0" max="60" step="1" required />
        <div className={authStyles.fieldPair}>
          <Input label="Reference 1 name" name="reference_1_name" maxLength={120} required />
          <PhoneInput label="Reference 1 mobile" name="reference_1_phone" required />
        </div>
        <div className={authStyles.fieldPair}>
          <Input label="Reference 2 name" name="reference_2_name" maxLength={120} required />
          <PhoneInput label="Reference 2 mobile" name="reference_2_phone" required />
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Services you provide</legend>
        {services.length === 0 && <StatusMessage status="warning">No services are available yet. Try again later or contact the administrator.</StatusMessage>}
        {services.map((service) => {
          const picked = chosen.includes(service.id);
          const proofId = `proof-${service.id}`;
          return <div key={service.id} className={styles.service}>
            <Checkbox
              name="service_ids"
              value={service.id}
              label={`${service.category} — ${service.name}`}
              checked={picked}
              onChange={(event) => setChosen((list) => event.target.checked ? [...list, service.id] : list.filter((id) => id !== service.id))}
            />
            {picked && <div className={styles.proof}>
              <label htmlFor={proofId} className={styles.proofLabel}>Proof for {service.name}</label>
              <input
                id={proofId}
                className={styles.proofInput}
                type="file"
                multiple
                accept={PROOF_SLOT?.types.join(",")}
                onChange={(event) => pickProofs(service.id, event.target.files)}
              />
              <p className={styles.note}>
                A certificate, or up to 3 photos of past work for this service. PDF, DOC, DOCX, PNG, JPG or WebP, up to {formatBytes(DOCUMENT_MAX_BYTES)} each.
                Only admins can see them. Each service is approved separately.
              </p>
              {(proofs[service.id] ?? []).length > 0 && <p className={styles.note}>Chosen: {(proofs[service.id] ?? []).map((file) => file.name).join(", ")}</p>}
              {proofErrors[service.id] && <StatusMessage status="error">{proofErrors[service.id] as string}</StatusMessage>}
            </div>}
          </div>;
        })}
      </fieldset>

      <Checkbox name="consent" value="yes" required label="I confirm this information is accurate and consent to admin review of these verification documents." />

      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <TurnstileWidget onToken={setCaptchaToken} resetSignal={captchaReset} />
      <Button
        id="apply-submit"
        type="submit"
        variant="primary"
        loading={busy}
        disabled={busy || services.length === 0 || progress.missing.length > 0}
        disabledReason={progress.missing.length > 0 ? `Upload the required documents first: ${progress.missing.join(", ")}.` : undefined}
      >
        Apply
      </Button>
    </form>

    <ProviderDocumentsDialog open={dialogOpen} files={files} onChange={setFile} onClose={() => setDialogOpen(false)} />

    <div className={authStyles.divider} role="separator"><span>or</span></div>
    <GoogleButton label="Apply with Google" intent="provider" />
    <div className={authStyles.cardFooter}>
      <span>Already have an account? <Link href="/login">Log in</Link></span>
    </div>
  </>;
}
