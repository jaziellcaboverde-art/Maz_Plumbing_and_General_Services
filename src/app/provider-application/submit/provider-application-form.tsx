"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUpload } from "@/components/ui/file-upload";
import { Select } from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import { LocationPicker } from "@/components/location/location-picker";
import type { Coordinates } from "@/lib/location/coordinates";
import { METRO_MANILA_AREAS } from "@/lib/location/metro-manila";
import styles from "../../(public)/auth.module.css";

type Service = { id: string; category: string; name: string };
export function ProviderApplicationForm({ services, nbiClearanceRequired }: { services: Service[]; nbiClearanceRequired: boolean }) {
  const router = useRouter();
  const [files, setFiles] = useState<{ government_id?: File; selfie?: File; nbi_clearance?: File }>({});
  const [baseLocation, setBaseLocation] = useState<(Coordinates & { address: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selected = form.getAll("service_ids");
    if (!form.getAll("service_areas").length) { setError("Select at least one Metro Manila area you serve."); return; }
    if (!selected.length) { setError("Choose at least one service."); return; }
    if (!files.government_id || !files.selfie) { setError("Upload both a government ID and a selfie."); return; }
    if (nbiClearanceRequired && !files.nbi_clearance) { setError("Upload your NBI clearance because it is required for this application."); return; }
    if (!baseLocation) { setError("Choose your base location on the map."); return; }
    form.delete("service_ids");
    selected.forEach((id) => form.append("service_ids", String(id)));
    form.set("government_id", files.government_id);
    form.set("selfie", files.selfie);
    if (files.nbi_clearance) form.set("nbi_clearance", files.nbi_clearance);
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
    <p>Submit your service area, expected daily rate, and verification documents. Only admins can view your ID and selfie. Your account stays in applicant mode until an admin approves it.</p>
    <form className={styles.form} onSubmit={submit}>
      <fieldset><legend>Metro Manila areas you serve</legend>
        <p>Select every city or municipality where you can take jobs. The admin will check your base location during review.</p>
        {METRO_MANILA_AREAS.map((area) => <label key={area} style={{ display: "block", marginBlock: 8 }}>
          <input type="checkbox" name="service_areas" value={area} /> {area}
        </label>)}
      </fieldset>
      <Input label="Expected daily rate (PHP)" name="daily_rate" type="number" min="0" step="0.01" required />
      <LocationPicker onSaved={(point, address) => address && setBaseLocation({ ...point, address })} />
      {baseLocation && <p>Selected base location: {baseLocation.address}</p>}
      <Input label="Emergency contact name" name="emergency_contact_name" maxLength={120} required />
      <Input label="Emergency contact mobile" name="emergency_contact_phone" type="tel" inputMode="tel" placeholder="+639XXXXXXXXX" required />
      <fieldset><legend>Services you provide</legend>
        {services.map((service) => <label key={service.id} style={{ display: "block", marginBlock: 8 }}>
          <input type="checkbox" name="service_ids" value={service.id} /> {service.category} — {service.name}
        </label>)}
        {services.length === 0 && <p>No services are available yet. Contact the administrator.</p>}
      </fieldset>
      <FileUpload label="Government ID" accept="image/jpeg,image/png,image/webp,application/pdf" acceptLabel="JPG, PNG, WebP or PDF" maxBytes={10 * 1024 * 1024} hint="Up to 10 MB. Visible to admins only." fileName={files.government_id?.name} onSelect={(file) => setFiles((value) => ({ ...value, government_id: file }))} onRemove={() => setFiles((value) => ({ ...value, government_id: undefined }))} />
      <FileUpload label="Selfie" accept="image/jpeg,image/png,image/webp" acceptLabel="JPG, PNG or WebP" maxBytes={5 * 1024 * 1024} hint="Up to 5 MB. Visible to admins only." fileName={files.selfie?.name} onSelect={(file) => setFiles((value) => ({ ...value, selfie: file }))} onRemove={() => setFiles((value) => ({ ...value, selfie: undefined }))} />
      {nbiClearanceRequired && <FileUpload label="NBI clearance" accept="image/jpeg,image/png,image/webp,application/pdf" acceptLabel="JPG, PNG, WebP or PDF" maxBytes={10 * 1024 * 1024} hint="Required by the current provider hiring policy. Visible to admins only." fileName={files.nbi_clearance?.name} onSelect={(file) => setFiles((value) => ({ ...value, nbi_clearance: file }))} onRemove={() => setFiles((value) => ({ ...value, nbi_clearance: undefined }))} />}
      <label><input type="checkbox" name="consent" value="yes" required /> I confirm this information is accurate and consent to admin review of these verification documents.</label>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <Button type="submit" variant="primary" loading={busy} disabled={busy || services.length === 0}>Submit application</Button>
    </form>
  </section>;
}
