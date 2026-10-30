"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { FileUpload } from "@/components/ui/file-upload";
import { StatusMessage } from "@/components/ui/status-message";
import { ProviderRequirements } from "@/components/provider/provider-requirements";
import { LocationPicker } from "@/components/location/location-picker";
import type { Coordinates } from "@/lib/location/coordinates";
import { METRO_MANILA_AREAS } from "@/lib/location/metro-manila";
import styles from "../../(public)/auth.module.css";

type Service = { id: string; category: string; name: string };
type AccountDefaults = { firstName: string; lastName: string; birthday: string; mobile: string };
export function ProviderApplicationForm({ services, account }: { services: Service[]; account: AccountDefaults | null }) {
  const router = useRouter();
  const [files, setFiles] = useState<{ government_id?: File; selfie?: File; nbi_clearance?: File; proof_of_address?: File; skill_certificate?: File; resume?: File; medical_certificate?: File }>({});
  const [chosen, setChosen] = useState<string[]>([]);
  const [proofs, setProofs] = useState<Record<string, File[]>>({});
  const [baseLocation, setBaseLocation] = useState<(Coordinates & { address: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selected = form.getAll("service_ids");
    if (!form.getAll("service_areas").length) { setError("Select at least one Metro Manila area you serve."); return; }
    if (!selected.length) { setError("Choose at least one service."); return; }
    for (const id of selected) {
      const list = proofs[String(id)] ?? [];
      const name = services.find((svc) => svc.id === id)?.name ?? "a service";
      if (list.length < 1) { setError(`Add proof for ${name}: a certificate or up to 3 photos of your past work.`); return; }
      if (list.length > 3 || list.some((f) => f.size > 10 * 1024 * 1024 || !/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type))) {
        setError(`The proof for ${name} must be up to 3 files (JPG, PNG, WebP or PDF, 10 MB each).`); return;
      }
    }
    if (!files.government_id || !files.selfie) { setError("Upload both a government ID and a selfie holding your ID."); return; }
    if (!files.proof_of_address) { setError("Upload a barangay clearance or a recent bill that shows your address."); return; }
    if (!files.nbi_clearance) { setError("Upload your NBI clearance because it is required for this application."); return; }
    if (!baseLocation) { setError("Choose your base location on the map."); return; }
    selected.forEach((id) => (proofs[String(id)] ?? []).forEach((file) => form.append(`proof_${id}`, file)));
    form.delete("service_ids");
    selected.forEach((id) => form.append("service_ids", String(id)));
    form.set("government_id", files.government_id);
    form.set("selfie", files.selfie);
    if (files.nbi_clearance) form.set("nbi_clearance", files.nbi_clearance);
    form.set("proof_of_address", files.proof_of_address);
    if (files.skill_certificate) form.set("skill_certificate", files.skill_certificate);
    if (files.resume) form.set("resume", files.resume);
    if (files.medical_certificate) form.set("medical_certificate", files.medical_certificate);
    form.set("latitude", String(baseLocation.latitude));
    form.set("longitude", String(baseLocation.longitude));
    form.set("base_address", baseLocation.address);
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/provider-applications", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not submit the application.");
      router.replace("/provider-application"); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not submit the application."); }
    finally { setBusy(false); }
  }
  return <section className={styles.page}>
    <h1>Provider application</h1>
    <p>Submit your service area, expected daily rate, and the required verification documents. You cannot submit until every required document is uploaded. Only admins can view your ID and selfie. Your account stays in applicant mode until an admin approves it.</p>
    <ProviderRequirements />
    <form className={styles.form} onSubmit={submit}>
      {account && <fieldset><legend>Your details</legend>
        <p>We need these to review your application. You must be at least 18.</p>
        <Input label="First name" name="account_first_name" autoComplete="given-name" defaultValue={account.firstName} required />
        <Input label="Last name" name="account_last_name" autoComplete="family-name" defaultValue={account.lastName} required />
        <Input label="Date of birth" name="account_birthday" type="date" autoComplete="bday" defaultValue={account.birthday} required />
        <PhoneInput label="Mobile number" name="account_mobile" defaultValue={account.mobile} hint="Kept private." required />
      </fieldset>}
      <fieldset><legend>Metro Manila areas you serve</legend>
        <p>Select every city or municipality where you can take jobs. The admin will check your base location during review.</p>
        {METRO_MANILA_AREAS.map((area) => <label key={area} style={{ display: "block", marginBlock: "var(--space-1)" }}>
          <input type="checkbox" name="service_areas" value={area} /> {area}
        </label>)}
      </fieldset>
      <Input label="Expected daily rate (PHP)" name="daily_rate" type="number" min="0" step="0.01" required />
      <LocationPicker onSaved={(point, address) => address && setBaseLocation({ ...point, address })} />
      {baseLocation && <p>Selected base location: {baseLocation.address}</p>}
      <Input label="Emergency contact name" name="emergency_contact_name" maxLength={120} required />
      <PhoneInput label="Emergency contact mobile" name="emergency_contact_phone" required />
      <fieldset><legend>Experience and references</legend>
        <p>Admins may call your references. Use people who have seen your work, not family.</p>
        <Input label="Years of experience in this trade" name="years_experience" type="number" min="0" max="60" step="1" required />
        <Input label="Reference 1 name" name="reference_1_name" maxLength={120} required />
        <PhoneInput label="Reference 1 mobile" name="reference_1_phone" required />
        <Input label="Reference 2 name" name="reference_2_name" maxLength={120} required />
        <PhoneInput label="Reference 2 mobile" name="reference_2_phone" required />
      </fieldset>
      <fieldset><legend>Services you provide</legend>
        {services.map((service) => <div key={service.id}>
          <label>
            <input type="checkbox" name="service_ids" value={service.id} checked={chosen.includes(service.id)}
              onChange={(e) => setChosen((list) => e.target.checked ? [...list, service.id] : list.filter((id) => id !== service.id))} /> {service.category} — {service.name}
          </label>
          {chosen.includes(service.id) && <div>
            <label htmlFor={`proof-${service.id}`}>Proof for {service.name}</label>
            <input id={`proof-${service.id}`} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setProofs((value) => ({ ...value, [service.id]: Array.from(e.target.files ?? []) }))} />
            <p>A certificate, or up to 3 photos of past work for this service. Only admins can see them. Each service is approved separately.</p>
          </div>}
        </div>)}
        {services.length === 0 && <p>No services are available yet. Contact the administrator.</p>}
      </fieldset>
      <FileUpload label="Government ID (required)" accept="image/jpeg,image/png,image/webp,application/pdf" acceptLabel="JPG, PNG, WebP or PDF" maxBytes={10 * 1024 * 1024} hint="Up to 10 MB. Visible to admins only." fileName={files.government_id?.name} onSelect={(file) => setFiles((value) => ({ ...value, government_id: file }))} onRemove={() => setFiles((value) => ({ ...value, government_id: undefined }))} />
      <FileUpload label="Selfie holding your ID (required)" accept="image/jpeg,image/png,image/webp" acceptLabel="JPG, PNG or WebP" maxBytes={5 * 1024 * 1024} hint="Up to 5 MB. Visible to admins only." fileName={files.selfie?.name} onSelect={(file) => setFiles((value) => ({ ...value, selfie: file }))} onRemove={() => setFiles((value) => ({ ...value, selfie: undefined }))} />
      <FileUpload label="NBI clearance (required)" accept="image/jpeg,image/png,image/webp,application/pdf" acceptLabel="JPG, PNG, WebP or PDF" maxBytes={10 * 1024 * 1024} hint="Required. Visible to admins only." fileName={files.nbi_clearance?.name} onSelect={(file) => setFiles((value) => ({ ...value, nbi_clearance: file }))} onRemove={() => setFiles((value) => ({ ...value, nbi_clearance: undefined }))} />
      <FileUpload label="Barangay clearance or proof of address (required)" accept="image/jpeg,image/png,image/webp,application/pdf" acceptLabel="JPG, PNG, WebP or PDF" maxBytes={10 * 1024 * 1024} hint="A barangay clearance, or a utility bill or lease from the last 3 months. Visible to admins only." fileName={files.proof_of_address?.name} onSelect={(file) => setFiles((value) => ({ ...value, proof_of_address: file }))} onRemove={() => setFiles((value) => ({ ...value, proof_of_address: undefined }))} />
      <FileUpload label="Skills certificate (optional)" accept="image/jpeg,image/png,image/webp,application/pdf" acceptLabel="JPG, PNG, WebP or PDF" maxBytes={10 * 1024 * 1024} hint="For example TESDA NC II in plumbing or electrical. Helps your application. Visible to admins only." fileName={files.skill_certificate?.name} onSelect={(file) => setFiles((value) => ({ ...value, skill_certificate: file }))} onRemove={() => setFiles((value) => ({ ...value, skill_certificate: undefined }))} />
      <FileUpload label="Resume or work history (optional)" accept="image/jpeg,image/png,image/webp,application/pdf" acceptLabel="JPG, PNG, WebP or PDF" maxBytes={10 * 1024 * 1024} hint="A resume or a short written list of your past jobs. Up to 10 MB. Visible to admins only." fileName={files.resume?.name} onSelect={(file) => setFiles((value) => ({ ...value, resume: file }))} onRemove={() => setFiles((value) => ({ ...value, resume: undefined }))} />
      <FileUpload label="Medical or fit-to-work certificate (optional)" accept="image/jpeg,image/png,image/webp,application/pdf" acceptLabel="JPG, PNG, WebP or PDF" maxBytes={10 * 1024 * 1024} hint="A recent health or fit-to-work certificate from a clinic. Up to 10 MB. Visible to admins only." fileName={files.medical_certificate?.name} onSelect={(file) => setFiles((value) => ({ ...value, medical_certificate: file }))} onRemove={() => setFiles((value) => ({ ...value, medical_certificate: undefined }))} />
      <label><input type="checkbox" name="consent" value="yes" required /> I confirm this information is accurate and consent to admin review of these verification documents.</label>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <Button type="submit" variant="primary" loading={busy} disabled={busy || services.length === 0}>Submit application</Button>
    </form>
  </section>;
}
