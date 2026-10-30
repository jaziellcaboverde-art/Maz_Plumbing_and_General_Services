"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Lock, LogIn, Mail, User } from "lucide-react";
import { GoogleButton } from "@/components/auth/google-button";
import { TurnstileWidget, turnstileEnabled } from "@/components/auth/turnstile-widget";
import { LocationPicker } from "@/components/location/location-picker";
import { ProviderDocumentsDialog, requiredUploaded, type ProviderFiles } from "@/components/provider/provider-documents-dialog";
import { ProviderRequirements } from "@/components/provider/provider-requirements";
import { BrandMark } from "@/components/public/brand-mark";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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

const STEPS = [
  { id: "account", label: "Your account", hint: "Name, email, password and location" },
  { id: "documents", label: "Upload documents", hint: "ID and requirements" },
  { id: "skills", label: "Skills setup", hint: "Services, rate and references" },
] as const;

/** Screens in order. Step 1 of the sidebar has two screens: account details, then location. */
const SCREEN_STEP = [0, 0, 1, 2] as const;

function isAdult(birthday: string): boolean {
  const born = new Date(`${birthday}T00:00:00`);
  if (!birthday || Number.isNaN(born.valueOf())) return false;
  const adult = new Date(born);
  adult.setFullYear(adult.getFullYear() + 18);
  return adult <= new Date();
}

/** True when every field inside one step passes the browser's own checks (required, email, minLength...). */
function fieldsValid(panel: HTMLElement | null): boolean {
  if (!panel) return false;
  return Array.from(panel.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")).every((field) => field.checkValidity());
}

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
  const [popupOpen, setPopupOpen] = useState(false);
  const [screen, setScreen] = useState(0);
  const [mapMounted, setMapMounted] = useState(false);
  const [stepOk, setStepOk] = useState<boolean[]>([false, false, false, false]);
  const step = SCREEN_STEP[screen];
  const formRef = useRef<HTMLFormElement>(null);
  const panels = useRef<Array<HTMLDivElement | null>>([]);

  const progress = requiredUploaded(files);
  const uploadedCount = DOCUMENT_SLOTS.filter((slot) => files[slot.kind]).length;

  /** Works out which steps are complete. Continue and Create account stay disabled until the current one is. */
  function recheck() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const details = fieldsValid(panels.current[0])
      && isPhMobile(String(data.get("account_mobile") ?? "").trim())
      && isAdult(String(data.get("account_birthday") ?? ""));
    const location = data.getAll("service_areas").length > 0 && Boolean(baseLocation);
    const documents = progress.missing.length === 0;
    const skills = fieldsValid(panels.current[3])
      && chosen.length > 0
      && chosen.every((id) => (proofs[id] ?? []).length > 0)
      && (!turnstileEnabled || Boolean(captchaToken));
    const next = [details, location, documents, skills];
    setStepOk((current) => (current.every((value, index) => value === next[index]) ? current : next));
  }

  // Fields are not controlled, so check again after every render and after every keystroke (onInput below).
  useEffect(() => { recheck(); });

  function go(target: number) {
    setError(null);
    setScreen(target);
    if (target === 1) setMapMounted(true); // the map is created only once it is on screen, so it gets its real size
    window.scrollTo({ top: 0 });
  }

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
    if (busy || screen !== SCREEN_STEP.length - 1) return;
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
      setPopupOpen(true);
      window.scrollTo({ top: 0 });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send your application. Try again.");
    } finally {
      setBusy(false);
      setCaptchaReset((count) => count + 1);
    }
  }

  if (summary) {
    return <div className={styles.submittedScreen} data-login-screen="true">
      <div className={styles.submittedCard}><ApplicationSubmitted summary={summary} /></div>
      <Modal
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        title="Application sent"
        footer={<Button variant="primary" onClick={() => setPopupOpen(false)}>OK</Button>}
      >
        <p className={styles.popupText}>Your application was sent to the MAZ admin team for review. We emailed a confirmation link to {summary.email}. We will email you the result once an admin has reviewed it.</p>
        <p className={styles.popupText}>Reference: <span className={styles.popupReference}>{summary.reference}</span></p>
      </Modal>
    </div>;
  }

  const uploadStatus = progress.missing.length
    ? `${progress.done} of ${progress.total} required documents uploaded`
    : `All required documents uploaded (${uploadedCount} file${uploadedCount === 1 ? "" : "s"})`;

  const serviceGroups = services.reduce<Array<{ category: string; items: ApplyService[] }>>((groups, service) => {
    const group = groups.find((item) => item.category === service.category);
    if (group) group.items.push(service);
    else groups.push({ category: service.category, items: [service] });
    return groups;
  }, []);
  const last = screen === SCREEN_STEP.length - 1;
  const reasons = [
    "Fill in every required field to continue. Use a mobile number that starts with 9 and a password of at least 8 characters.",
    "Choose at least one area you serve and set your base location to continue.",
    progress.missing.length ? `Upload the required documents first: ${progress.missing.join(", ")}.` : "Upload the required documents to continue.",
    "Complete every field, choose at least one service and add proof for each service to create your account.",
  ];
  const blocked = !stepOk[screen] || (last && services.length === 0);

  return <div className={styles.screen} data-login-screen="true">
    <aside className={styles.aside} aria-label="MAZ Plumbing and General Services">
      <Link className={styles.brand} href="/">
        <span className={styles.brandMark}><BrandMark priority /></span>
        <span className={styles.brandText}>
          <span className={styles.brandName}>MAZ Plumbing</span>
          <span className={styles.brandSub}>and General Services</span>
        </span>
      </Link>
      <p className={styles.asideLabel}>Set up your account</p>
      <nav aria-label="Application progress">
        <ol className={styles.steps}>
          {STEPS.map((item, index) => {
            const state = index < step ? "complete" : index === step ? "current" : "upcoming";
            return <li key={item.id} className={`${styles.step} ${styles[state]}`} aria-current={index === step ? "step" : undefined}>
              <span className={styles.marker}>
                {state === "complete" ? <Check className={styles.markerIcon} aria-hidden="true" /> : <span aria-hidden="true">{index + 1}</span>}
              </span>
              <span className={styles.stepText}>
                <span className="sr-only">Step {index + 1} of {STEPS.length}{state === "complete" ? ", completed" : ""}: </span>
                <span className={styles.stepName}>{item.label}</span>
                <span className={styles.stepHint}>{item.hint}</span>
              </span>
            </li>;
          })}
        </ol>
      </nav>
      <div className={styles.asideFoot}>
        <LogIn className={styles.asideFootIcon} aria-hidden="true" />
        <p className={styles.asideFootText}>
          <span className={styles.asideFootTitle}>Already have an account?</span>
          <Link className={styles.asideFootLink} href="/login">Log in</Link>
        </p>
      </div>
    </aside>

    <main className={styles.main}>
      <div className={styles.panelWrap}>
        <form ref={formRef} className={authStyles.form} onSubmit={submit} onInput={recheck} onChange={recheck} noValidate>

          <div className={styles.panel} hidden={screen !== 0} ref={(node) => { panels.current[0] = node; }}>
            <p className={styles.kicker}>Step 1 of {STEPS.length}</p>
            <h1 className={styles.panelTitle}>Set up your account</h1>
            <p className={styles.intro}>Tell us who you are. An admin reviews your application and we email you the result.</p>
            <fieldset className={styles.section}>
              <legend className="sr-only">Your account</legend>
              <div className={authStyles.fieldPair}>
                <Input label="First name" name="account_first_name" autoComplete="given-name" icon={<User />} required />
                <Input label="Last name" name="account_last_name" autoComplete="family-name" icon={<User />} required />
              </div>
              <div className={authStyles.fieldPair}>
                <Input label="Date of birth" name="account_birthday" type="date" autoComplete="bday" required />
                <PhoneInput label="Mobile number" name="account_mobile" required />
              </div>
              <Input label="Email" name="email" type="email" autoComplete="email" icon={<Mail />} required />
              <Input label="Password" name="password" type="password" autoComplete="new-password" minLength={8} hint="At least 8 characters." icon={<Lock />} required />
            </fieldset>
          </div>

          <div className={styles.panel} hidden={screen !== 1} ref={(node) => { panels.current[1] = node; }}>
            <p className={styles.kicker}>Step 1 of {STEPS.length}</p>
            <h1 className={styles.panelTitle}>Choose my location</h1>
            <p className={styles.intro}>Select every city or municipality where you can take jobs, then set your base location. The admin will check it during review.</p>
            <fieldset className={styles.section}>
              <legend>Areas you serve</legend>
              <div className={styles.areaGrid}>
                {METRO_MANILA_AREAS.map((area) => <Checkbox key={area} name="service_areas" value={area} label={area} />)}
              </div>
            </fieldset>
            {mapMounted && <LocationPicker onSaved={(point, address) => address && setBaseLocation({ ...point, address })} />}
            {baseLocation && <StatusMessage status="success">Base location: {baseLocation.address}</StatusMessage>}
          </div>

          <div className={styles.panel} hidden={screen !== 2} ref={(node) => { panels.current[2] = node; }}>
            <p className={styles.kicker}>Step 2 of {STEPS.length}</p>
            <h1 className={styles.panelTitle}>Upload documents</h1>
            <ProviderRequirements
              headingLevel={3}
              action={<>
                <Button onClick={() => setDialogOpen(true)}>Upload documents</Button>
                <p className={styles.uploadStatus} role="status">{uploadStatus}</p>
              </>}
            />
          </div>

          <div className={styles.panel} hidden={screen !== 3} ref={(node) => { panels.current[3] = node; }}>
            <p className={styles.kicker}>Step 3 of {STEPS.length}</p>
            <h1 className={styles.panelTitle}>Skills setup</h1>
            <fieldset className={styles.section}>
              <legend>Services you provide</legend>
              {services.length === 0 && <StatusMessage status="warning">No services are available yet. Try again later or contact the administrator.</StatusMessage>}
              {serviceGroups.map((group) => <div key={group.category} className={styles.group}>
                <h3 className={styles.groupTitle}>{group.category}</h3>
                <div className={styles.serviceGrid}>
                  {group.items.map((service) => {
                    const picked = chosen.includes(service.id);
                    const proofId = `proof-${service.id}`;
                    return <div key={service.id} className={picked ? `${styles.service} ${styles.servicePicked}` : styles.service}>
                      <Checkbox
                        name="service_ids"
                        value={service.id}
                        label={service.name}
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
                </div>
              </div>)}
            </fieldset>

            <fieldset className={styles.section}>
              <legend>Experience and rate</legend>
              <div className={authStyles.fieldPair}>
                <Input label="Years of experience in this trade" name="years_experience" type="number" min="0" max="60" step="1" required />
                <Input label="Expected daily rate (PHP)" name="daily_rate" type="number" min="0" step="0.01" required />
              </div>
            </fieldset>

            <fieldset className={styles.section}>
              <legend>Emergency contact</legend>
              <div className={authStyles.fieldPair}>
                <Input label="Emergency contact name" name="emergency_contact_name" maxLength={120} required />
                <PhoneInput label="Emergency contact mobile" name="emergency_contact_phone" required />
              </div>
            </fieldset>

            <fieldset className={styles.section}>
              <legend>References</legend>
              <p className={styles.note}>Admins may call your references. Use people who have seen your work, not family.</p>
              <div className={authStyles.fieldPair}>
                <Input label="Reference 1 name" name="reference_1_name" maxLength={120} required />
                <PhoneInput label="Reference 1 mobile" name="reference_1_phone" required />
              </div>
              <div className={authStyles.fieldPair}>
                <Input label="Reference 2 name" name="reference_2_name" maxLength={120} required />
                <PhoneInput label="Reference 2 mobile" name="reference_2_phone" required />
              </div>
            </fieldset>

            <Checkbox name="consent" value="yes" required label="I confirm this information is accurate and consent to admin review of these verification documents." />
            <TurnstileWidget onToken={setCaptchaToken} resetSignal={captchaReset} />
          </div>

          {error && <StatusMessage status="error">{error}</StatusMessage>}

          <div className={styles.actions}>
            <ButtonGroup>
              {/* Separate keys: the button must be a new element when it turns into the submit button, or the click that moves to step 3 would also submit. */}
              <Button
                key={last ? "create" : "continue"}
                id="apply-next"
                type={last ? "submit" : "button"}
                variant="primary"
                className={styles.cta}
                loading={last && busy}
                disabled={busy || blocked}
                disabledReason={!stepOk[screen] ? reasons[screen] : undefined}
                onClick={last ? undefined : () => go(screen + 1)}
              >
                {last ? "Create account" : "Continue"}
              </Button>
              {screen > 0 && <Button id="apply-back" disabled={busy} onClick={() => go(screen - 1)}>Back</Button>}
            </ButtonGroup>
          </div>
        </form>

        <ProviderDocumentsDialog open={dialogOpen} files={files} onChange={setFile} onClose={() => setDialogOpen(false)} />

        {screen === 0 && <>
          <div className={authStyles.divider} role="separator"><span>or</span></div>
          <GoogleButton label="Apply with Google" intent="provider" />
        </>}
      </div>
    </main>
  </div>;
}
