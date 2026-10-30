"use client";

import { useState, type FormEvent } from "react";
import { CityBarangayFields } from "@/components/location/city-barangay-fields";
import { LocationPicker } from "@/components/location/location-picker";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusMessage } from "@/components/ui/status-message";
import type { Coordinates } from "@/lib/location/coordinates";
import { createClient } from "@/lib/supabase/browser";
import styles from "./address-settings.module.css";

export type AddressItem = {
  id: string;
  label: string | null;
  line1: string;
  barangay: string | null;
  city: string;
  landmark: string | null;
  hasPin: boolean;
  /** Current pin, when it could be read. */
  point?: Coordinates;
  /** True when a submitted booking that is not finished uses this address. It cannot be deleted then. */
  inUse: boolean;
};

const lineOf = (a: Pick<AddressItem, "line1" | "barangay" | "city">) => [a.line1, a.barangay, a.city].filter(Boolean).join(", ");

/** Settings section where a customer edits, re-pins or deletes saved service addresses (new addresses are added while booking). */
export function AddressSettings({ initialAddresses }: { initialAddresses: AddressItem[] }) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState({ label: "", line1: "", city: "", barangay: "", landmark: "" });
  const [point, setPoint] = useState<Coordinates | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AddressItem | null>(null);

  const editing = addresses.find((item) => item.id === editingId) ?? null;

  function startEdit(item: AddressItem) {
    setEditingId(item.id);
    setFields({ label: item.label ?? "", line1: item.line1, city: item.city, barangay: item.barangay ?? "", landmark: item.landmark ?? "" });
    setPoint(null);
    setError(null);
    setNotice(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || busy) return;
    if (!fields.line1.trim() || !fields.city || !fields.barangay) {
      setError("Enter the street address and choose the city and barangay.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.from("addresses").update({
        label: fields.label.trim() || null,
        line1: fields.line1.trim(),
        barangay: fields.barangay || null,
        city: fields.city,
        province: "Metro Manila",
        landmark: fields.landmark.trim() || null,
      }).eq("id", editing.id);
      if (updateError) throw new Error("Could not save the address. Check the fields and try again.");
      if (point) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Your session expired. Log in again.");
        const response = await fetch("/api/location/save", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ target: "address", recordId: editing.id, ...point }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "The details were saved but the new map pin was not. Try again.");
      }
      setAddresses((current) => current.map((item) => item.id === editing.id ? {
        ...item,
        label: fields.label.trim() || null,
        line1: fields.line1.trim(),
        barangay: fields.barangay || null,
        city: fields.city,
        landmark: fields.landmark.trim() || null,
        hasPin: item.hasPin || Boolean(point),
        point: point ?? item.point,
      } : item));
      setEditingId(null);
      setNotice("Address saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the address.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: deleteError } = await createClient().from("addresses").delete().eq("id", deleting.id);
      if (deleteError) throw new Error("Could not delete the address. Try again.");
      setAddresses((current) => current.filter((item) => item.id !== deleting.id));
      setDeleting(null);
      setNotice("Address deleted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the address.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="addresses-heading">
      <h2 id="addresses-heading" className={styles.title}>Service addresses</h2>
      <p className={styles.intro}>Fix a saved address or its map pin. You add a new address while booking a service.</p>
      {notice && <StatusMessage status="success">{notice}</StatusMessage>}
      {error && !editing && <StatusMessage status="error">{error}</StatusMessage>}
      {addresses.length === 0 && <p>You have no saved addresses yet. Add one when you book a service.</p>}
      <ul className={styles.list}>
        {addresses.map((item) => (
          <li key={item.id} className={styles.item}>
            {editing?.id === item.id ? (
              <form className={styles.form} onSubmit={save}>
                <Input label="Name for this address (optional)" name="label" maxLength={60} value={fields.label}
                  onChange={(event) => setFields((current) => ({ ...current, label: event.target.value }))} />
                <LocationPicker showLandmark={false} restrictToMetroManila initialPoint={item.point} onSaved={setPoint}
                  onAddress={(parts) => setFields((current) => ({
                    ...current, line1: parts.line1 || current.line1, city: parts.city || current.city, barangay: parts.city ? parts.barangay : current.barangay,
                  }))} />
                <h3 className={styles.subheading}>Confirm the address</h3>
                <Input label="Street address" name="line1" autoComplete="address-line1" value={fields.line1} required
                  onChange={(event) => setFields((current) => ({ ...current, line1: event.target.value }))} />
                <CityBarangayFields city={fields.city} barangay={fields.barangay} onChange={(next) => setFields((current) => ({ ...current, ...next }))} />
                <Input label="Landmark (optional)" name="landmark" value={fields.landmark}
                  onChange={(event) => setFields((current) => ({ ...current, landmark: event.target.value }))} />
                {error && <StatusMessage status="error">{error}</StatusMessage>}
                <ButtonGroup>
                  <Button type="submit" variant="primary" loading={busy} disabled={busy}>Save address</Button>
                  <Button type="button" disabled={busy} onClick={() => setEditingId(null)}>Cancel</Button>
                </ButtonGroup>
              </form>
            ) : (
              <>
                <div>
                  <p className={styles.name}>{item.label ?? "Saved address"}</p>
                  <p>{lineOf(item)}</p>
                  {item.landmark && <p className={styles.meta}>Landmark: {item.landmark}</p>}
                  {!item.hasPin && <p className={styles.meta}>No map pin yet. Edit this address to add one.</p>}
                </div>
                <ButtonGroup>
                  <Button type="button" onClick={() => startEdit(item)}>Edit</Button>
                  <Button type="button" onClick={() => { setError(null); setNotice(null); setDeleting(item); }}
                    disabled={item.inUse} disabledReason="A booking that is not finished uses this address.">Delete</Button>
                </ButtonGroup>
              </>
            )}
          </li>
        ))}
      </ul>
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this address?"
        error={error ?? undefined}
        footer={
          <ButtonGroup>
            <Button type="button" variant="primary" onClick={remove} loading={busy} disabled={busy}>Delete address</Button>
            <Button type="button" onClick={() => setDeleting(null)} disabled={busy}>Cancel</Button>
          </ButtonGroup>
        }
      >
        <p>{deleting ? lineOf(deleting) : ""}</p>
        <p>Drafts that use it will ask you to choose another address.</p>
      </Modal>
    </section>
  );
}
