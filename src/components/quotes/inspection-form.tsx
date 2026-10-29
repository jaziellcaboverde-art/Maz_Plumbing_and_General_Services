"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/browser";
import styles from "./quotes.module.css";

const EXTENSION: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTOS = 5;
const MAX_BYTES = 10 * 1024 * 1024;

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("unsupported")); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
}

/** Step 9.2: the provider is at the site. GPS, what they found, and photos. Large jobs only. */
export function InspectionForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [farAway, setFarAway] = useState<string | null>(null);
  const tooShort = notes.trim().length < 10;

  function pickFiles(list: FileList | null) {
    setError(null);
    const chosen = Array.from(list ?? []);
    if (chosen.length > MAX_PHOTOS) { setError(`Add up to ${MAX_PHOTOS} photos.`); return; }
    const bad = chosen.find((f) => !EXTENSION[f.type] || f.size > MAX_BYTES);
    if (bad) { setError("Photos must be JPG, PNG or WebP, up to 10 MB each."); return; }
    setFiles(chosen);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (tooShort || busy) return;
    setBusy(true); setError(null); setFarAway(null);
    let position: GeolocationPosition;
    try { position = await getPosition(); }
    catch { setBusy(false); setError("Could not get your location. Allow location access and try again at the site."); return; }

    const client = createClient();
    const photoPaths: string[] = [];
    for (const file of files) {
      const path = `${bookingId}/${crypto.randomUUID()}.${EXTENSION[file.type]}`;
      const { error: uploadError } = await client.storage.from("proof-photos").upload(path, file, { contentType: file.type });
      if (uploadError) { setBusy(false); setError("A photo could not be uploaded. Try again."); return; }
      photoPaths.push(path);
    }

    try {
      const response = await fetch(`/api/bookings/${bookingId}/inspection`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: position.coords.latitude, longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy, notes, photoPaths,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; recorded?: boolean; distanceM?: number; allowedRadiusM?: number } | null;
      setBusy(false);
      if (!response.ok) { setError(data?.error ?? "Something went wrong. Try again."); return; }
      if (!data?.recorded) {
        setFarAway(`You are about ${Math.round(data?.distanceM ?? 0)} m from the job address. Move within ${Math.round(data?.allowedRadiusM ?? 200)} m and try again, or ask an admin to record it.`);
        return;
      }
      router.refresh();
    } catch {
      setBusy(false); setError("Could not reach the server. Check your connection and try again.");
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      {farAway && <StatusMessage status="warning">{farAway}</StatusMessage>}
      <Textarea label="What did you find at the site?" hint="Scope, access, materials needed. At least 10 characters." value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
      <div>
        <label htmlFor="inspection-photos">Photos (optional, up to {MAX_PHOTOS})</label>
        <input id="inspection-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => pickFiles(e.target.files)} />
        {files.length > 0 && <ul className={styles.photoList}>{files.map((f) => <li key={f.name + f.size} className={styles.photoName}>{f.name}</li>)}</ul>}
      </div>
      <Button type="submit" variant="primary" loading={busy} disabled={busy || tooShort} disabledReason={tooShort ? "Write at least 10 characters." : undefined}>
        I am at the site. Record inspection
      </Button>
    </form>
  );
}
