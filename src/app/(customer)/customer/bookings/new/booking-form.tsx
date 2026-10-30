"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CityBarangayFields } from "@/components/location/city-barangay-fields";
import { LocationPicker } from "@/components/location/location-picker";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUpload } from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import { Stepper, type Step } from "@/components/ui/stepper";
import { Textarea } from "@/components/ui/textarea";
import {
  draftColumns, jobClassFor, MAX_DESCRIPTION_LENGTH, MAX_PHOTO_BYTES, MAX_PHOTOS, MIN_DESCRIPTION_LENGTH,
  missingForSubmit, toLocalInputValue, type DraftValues,
} from "@/lib/booking/rules";
import type { Coordinates } from "@/lib/location/coordinates";
import { createClient } from "@/lib/supabase/browser";
import styles from "./booking-form.module.css";

export type ServiceOption = {
  id: string;
  category: string;
  name: string;
  defaultClass: "minor" | "major";
  urgentAllowed: boolean;
  description: string;
};
export type AddressOption = { id: string; label: string; hasPin: boolean };

type Props = {
  customerId: string;
  services: ServiceOption[];
  addresses: AddressOption[];
  initialDraftId: string | null;
  initialValues: DraftValues;
  initialPhotos: string[];
};

const STEPS: Step[] = [
  { id: "service", label: "Service" },
  { id: "details", label: "Details" },
  { id: "address", label: "Address" },
  { id: "when", label: "When" },
  { id: "review", label: "Review" },
];

type SaveState = "idle" | "saving" | "saved" | "error";

export function BookingForm({ customerId, services, addresses: initialAddresses, initialDraftId, initialValues, initialPhotos }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<DraftValues>(initialValues);
  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [addresses, setAddresses] = useState(initialAddresses);
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadKey, setUploadKey] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newAddress, setNewAddress] = useState(false);
  // The earliest time the date picker allows: one hour from when the form opened.
  const [minLocal] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000).toISOString()));

  const valuesRef = useRef(values);
  const draftIdRef = useRef(draftId);
  const lastSaved = useRef(initialDraftId ? JSON.stringify(draftColumns(initialValues)) : "");
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const service = services.find((item) => item.id === values.serviceId) ?? null;
  const serviceRules = useMemo(() => services.map((s) => ({ id: s.id, defaultClass: s.defaultClass, urgentAllowed: s.urgentAllowed })), [services]);
  const addressRules = useMemo(() => addresses.map((a) => ({ id: a.id, hasPin: a.hasPin })), [addresses]);
  const missing = missingForSubmit(values, serviceRules, addressRules);

  /** Save the draft now. Saves run one after another, so two never create two drafts. */
  const save = useCallback((): Promise<string | null> => {
    const run = async (): Promise<string | null> => {
      const current = valuesRef.current;
      const columns = draftColumns(current);
      const serialized = JSON.stringify(columns);
      if (!current.serviceId && !draftIdRef.current) return null;
      if (draftIdRef.current && serialized === lastSaved.current) return draftIdRef.current;
      setSaveState("saving");
      const supabase = createClient();
      if (draftIdRef.current) {
        const { error } = await supabase.from("bookings").update(columns).eq("id", draftIdRef.current);
        if (error) { setSaveState("error"); return null; }
      } else {
        const { data, error } = await supabase.from("bookings").insert({ customer_id: customerId, ...columns }).select("id").single();
        if (error || !data) { setSaveState("error"); return null; }
        draftIdRef.current = data.id;
        setDraftId(data.id);
        window.history.replaceState(null, "", `/customer/bookings/new?draft=${data.id}`);
      }
      lastSaved.current = serialized;
      setSaveState("saved");
      return draftIdRef.current;
    };
    const next = queue.current.then(run, run);
    queue.current = next;
    return next;
  }, [customerId]);

  function change(patch: Partial<DraftValues>) {
    const next = { ...valuesRef.current, ...patch };
    valuesRef.current = next;
    setValues(next);
    setSubmitError(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save(); }, 800);
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const serviceGroups = useMemo(() => {
    const groups = new Map<string, ServiceOption[]>();
    services.forEach((item) => groups.set(item.category, [...(groups.get(item.category) ?? []), item]));
    return [...groups.entries()];
  }, [services]);

  // ---- photos ------------------------------------------------------------------------------
  async function addPhoto(file: File) {
    setPhotoError(null);
    if (photos.length >= MAX_PHOTOS) { setPhotoError(`You can add up to ${MAX_PHOTOS} photos.`); return; }
    setUploading(true);
    try {
      const id = await save() ?? draftIdRef.current;
      if (!id) throw new Error("Could not save your draft. Check your connection and try again.");
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const name = `${crypto.randomUUID()}.${extension}`;
      const { error } = await createClient().storage.from("booking-photos").upload(`${id}/${name}`, file, { contentType: file.type });
      if (error) throw new Error("Could not upload the photo. Try again.");
      setPhotos((current) => [...current, name]);
      setUploadKey((key) => key + 1);
    } catch (caught) {
      setPhotoError(caught instanceof Error ? caught.message : "Could not upload the photo.");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(name: string) {
    if (!draftIdRef.current) return;
    const { error } = await createClient().storage.from("booking-photos").remove([`${draftIdRef.current}/${name}`]);
    if (error) { setPhotoError("Could not remove the photo. Try again."); return; }
    setPhotos((current) => current.filter((item) => item !== name));
  }

  // ---- new address -------------------------------------------------------------------------
  const [point, setPoint] = useState<Coordinates | null>(null);
  const [addressBusy, setAddressBusy] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [newFields, setNewFields] = useState({ line1: "", city: "", barangay: "" });

  async function addAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addressBusy) return;
    if (!point) { setAddressError("Choose the location on the map and select Use this location."); return; }
    const form = new FormData(event.currentTarget);
    const clean = (key: string) => String(form.get(key) ?? "").trim();
    setAddressBusy(true);
    setAddressError(null);
    const supabase = createClient();
    let createdId: string | null = null;
    try {
      const { data, error } = await supabase.from("addresses").insert({
        profile_id: customerId,
        label: clean("label") || null,
        line1: clean("line1"),
        barangay: clean("barangay") || null,
        city: clean("city"),
        province: "Metro Manila",
        landmark: clean("landmark") || null,
      }).select("id,label,line1,barangay,city").single();
      if (error || !data) throw new Error("Could not save the address. Check the fields and try again.");
      createdId = data.id;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session expired. Log in again.");
      const response = await fetch("/api/location/save", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ target: "address", recordId: data.id, ...point }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The map pin was not saved. Try again.");
      const option: AddressOption = { id: data.id, label: [data.label, data.line1, data.barangay, data.city].filter(Boolean).join(", "), hasPin: true };
      setAddresses((current) => [...current, option]);
      change({ addressId: data.id });
      setNewAddress(false);
      setNewFields({ line1: "", city: "", barangay: "" });
      setPoint(null);
    } catch (caught) {
      // Do not leave an address without a pin behind. A retry would add a second copy.
      if (createdId) await supabase.from("addresses").delete().eq("id", createdId);
      setAddressError(caught instanceof Error ? caught.message : "Could not save the address.");
    } finally {
      setAddressBusy(false);
    }
  }

  // ---- steps -------------------------------------------------------------------------------
  const address = addresses.find((item) => item.id === values.addressId);
  const startValid = !missing.some((item) => item.startsWith("Choose a date") || item.startsWith("Urgent requests"));
  const stepReady = [
    { ok: Boolean(service), why: "Choose a service to continue." },
    { ok: values.description.trim().length >= MIN_DESCRIPTION_LENGTH, why: `Describe the job in at least ${MIN_DESCRIPTION_LENGTH} characters.` },
    { ok: Boolean(address?.hasPin), why: "Choose a service address that has a map pin." },
    { ok: startValid, why: "Choose a date and time in the future, or switch on urgent." },
    { ok: missing.length === 0, why: "" },
  ];

  async function submit() {
    if (submitting || missing.length > 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const id = await save() ?? draftIdRef.current;
      if (!id) throw new Error("Could not save your draft. Check your connection and try again.");
      const { error } = await createClient().rpc("submit_booking", { p_booking_id: id, p_terms_accepted: values.termsAccepted });
      if (error) throw new Error(error.message);
      // The choose screen sends urgent and large jobs back to the booking page, where matching starts.
      router.push(values.isUrgent ? `/customer/bookings/${id}` : `/customer/bookings/${id}/choose`);
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "Could not submit your request.");
      setSubmitting(false);
    }
  }


  return (
    <div className={styles.form}>
      <Stepper steps={STEPS} current={step} label="Booking progress" />
      <p className={styles.saveState} role="status" aria-live="polite">
        {saveState === "saving" && "Saving draft…"}
        {saveState === "saved" && "Draft saved."}
        {saveState === "error" && "Could not save the draft. Check your connection. We will try again when you change something."}
      </p>

      {step === 0 && (
        <div className={styles.panel}>
          <Select label="Service" name="service" value={values.serviceId} onChange={(event) => change({ serviceId: event.target.value, isUrgent: false })}>
            <option value="">Choose a service</option>
            {serviceGroups.map(([category, items]) => (
              <optgroup key={category} label={category}>
                {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </optgroup>
            ))}
          </Select>
          {service?.description && <p className={styles.note}>{service.description}</p>}
          {service && (
            <Checkbox
              label="This is a major renovation of a house or condominium"
              checked={values.isMajorRenovation || service.defaultClass === "major"}
              disabled={service.defaultClass === "major"}
              onChange={(event) => change({ isMajorRenovation: event.target.checked })}
            />
          )}
          {service && jobClassFor(service, values.isMajorRenovation) === "major" && (
            <StatusMessage status="info">Major jobs get an admin-assigned foreman, and the price is agreed in stages.</StatusMessage>
          )}
          {services.length === 0 && <StatusMessage status="warning">No services are available yet. Please check back soon.</StatusMessage>}
        </div>
      )}

      {step === 1 && (
        <div className={styles.panel}>
          <Textarea
            label="Describe the job"
            name="description"
            value={values.description}
            maxLength={MAX_DESCRIPTION_LENGTH}
            hint="What is wrong, where it is, and anything the provider should know."
            onChange={(event) => change({ description: event.target.value })}
          />
          <div>
            <h2 className={styles.subheading}>Photos (optional)</h2>
            {photos.length > 0 && (
              <ul className={styles.photoList}>
                {photos.map((name, index) => (
                  <li key={name}>
                    <span>Photo {index + 1}</span>
                    <Button type="button" onClick={() => removePhoto(name)}>Remove</Button>
                  </li>
                ))}
              </ul>
            )}
            {photos.length < MAX_PHOTOS && (
              <FileUpload
                key={uploadKey}
                label={photos.length === 0 ? "Add a photo" : "Add another photo"}
                accept="image/jpeg,image/png,image/webp"
                acceptLabel="JPG, PNG or WebP"
                maxBytes={MAX_PHOTO_BYTES}
                hint={`Up to ${MAX_PHOTOS} photos, 5 MB each.`}
                progress={uploading ? 50 : undefined}
                error={photoError ?? undefined}
                disabled={uploading}
                onSelect={addPhoto}
              />
            )}
            {photos.length >= MAX_PHOTOS && <p className={styles.note}>You added the most photos allowed.</p>}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={styles.panel}>
          {addresses.length > 0 && !newAddress && (
            <Select label="Service address" name="address" value={values.addressId} onChange={(event) => change({ addressId: event.target.value })}>
              <option value="">Choose an address</option>
              {addresses.map((item) => <option key={item.id} value={item.id}>{item.label}{item.hasPin ? "" : " (no map pin)"}</option>)}
            </Select>
          )}
          {address && !address.hasPin && <StatusMessage status="warning">This address has no map pin. Choose another address or add a new one.</StatusMessage>}
          {!newAddress && <Button type="button" onClick={() => { setAddressError(null); setNewAddress(true); }}>Add a new address</Button>}
          {newAddress && (
            <form className={styles.panel} onSubmit={addAddress}>
              <Input label="Name for this address (optional)" name="label" placeholder="Home, Office" maxLength={60} />
              <LocationPicker showLandmark={false} restrictToMetroManila onSaved={setPoint} onAddress={(parts) => setNewFields((current) => ({
                line1: parts.line1 || current.line1, city: parts.city || current.city, barangay: parts.city ? parts.barangay : current.barangay,
              }))} />
              <h3 className={styles.subheading}>Confirm the address</h3>
              <p className={styles.note}>These fields fill in from the map. Check them and fix anything that is wrong.</p>
              <Input label="Street address" name="line1" autoComplete="address-line1" value={newFields.line1}
                onChange={(event) => setNewFields((current) => ({ ...current, line1: event.target.value }))} required />
              <CityBarangayFields city={newFields.city} barangay={newFields.barangay}
                onChange={(next) => setNewFields((current) => ({ ...current, ...next }))} />
              <Input label="Landmark (optional)" name="landmark" hint="A nearby building, gate or store that helps the provider find you." />
              {addressError && <StatusMessage status="error">{addressError}</StatusMessage>}
              <ButtonGroup>
                <Button type="submit" variant="primary" loading={addressBusy} disabled={addressBusy}>Save address</Button>
                <Button type="button" disabled={addressBusy} onClick={() => setNewAddress(false)}>Cancel</Button>
              </ButtonGroup>
            </form>
          )}
        </div>
      )}

      {step === 3 && (
        <div className={styles.panel}>
          <RadioGroup
            legend="When do you need us?"
            name="timing"
            value={values.isUrgent ? "urgent" : "scheduled"}
            onChange={(value) => change({ isUrgent: value === "urgent" })}
            options={[
              { value: "scheduled", label: "Pick a date and time" },
              { value: "urgent", label: "Urgent, as soon as possible", hint: service?.urgentAllowed ? "Offered to available providers right away." : "Only available for Emergency Service.", disabled: !service?.urgentAllowed },
            ]}
          />
          {!values.isUrgent && (
            <Input
              label="Preferred date and time"
              name="preferred_start"
              type="datetime-local"
              min={minLocal}
              value={values.preferredStartLocal}
              onChange={(event) => change({ preferredStartLocal: event.target.value })}
            />
          )}
        </div>
      )}

      {step === 4 && (
        <div className={styles.panel}>
          <dl className={styles.summary}>
            <div><dt>Service</dt><dd>{service?.name ?? "Not chosen"}{service && jobClassFor(service, values.isMajorRenovation) === "major" ? " (major job)" : ""}</dd></div>
            <div><dt>Details</dt><dd>{values.description || "Not written"}</dd></div>
            <div><dt>Photos</dt><dd>{photos.length}</dd></div>
            <div><dt>Address</dt><dd>{address?.label ?? "Not chosen"}</dd></div>
            <div><dt>When</dt><dd>{values.isUrgent ? "Urgent" : values.preferredStartLocal ? new Date(values.preferredStartLocal).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "Not chosen"}</dd></div>
          </dl>
          <p>Read the <Link href="/terms" target="_blank">Terms</Link> before you submit. You can leave now and finish later. Your draft stays saved.</p>
          <Checkbox label="I have read and accept the Terms." checked={values.termsAccepted} onChange={(event) => { setValues((current) => ({ ...current, termsAccepted: event.target.checked })); valuesRef.current = { ...valuesRef.current, termsAccepted: event.target.checked }; }} />
          {submitError && <StatusMessage status="error">{submitError}</StatusMessage>}
        </div>
      )}

      <ButtonGroup>
        {step < STEPS.length - 1 ? (
          <Button
            id="booking-next"
            type="button"
            variant="primary"
            disabled={!stepReady[step].ok}
            disabledReason={stepReady[step].why}
            onClick={() => { void save(); setStep(step + 1); }}
          >
            Continue
          </Button>
        ) : (
          <Button
            id="booking-submit"
            type="button"
            variant="primary"
            loading={submitting}
            disabled={submitting || missing.length > 0}
            disabledReason={missing.length > 0 ? `Still needed: ${missing.join("; ")}.` : undefined}
            onClick={submit}
          >
            Submit request
          </Button>
        )}
        {step > 0 && <Button type="button" onClick={() => setStep(step - 1)} disabled={submitting}>Back</Button>}
      </ButtonGroup>
    </div>
  );
}
