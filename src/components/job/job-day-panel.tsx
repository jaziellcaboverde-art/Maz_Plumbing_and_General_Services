"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/matching/client";
import { createClient } from "@/lib/supabase/browser";
import styles from "@/components/quotes/quotes.module.css";

const EXTENSION: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTOS = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const SHARE_EVERY_MS = 15000;

type Status = "deposit_paid" | "scheduled" | "on_the_way" | "in_progress";

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("unsupported")); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
}

/** The provider's job-day controls: schedule, On the way, check in, close the day (10.1 to 10.4). */
export function JobDayPanel({ bookingId, status, scheduledStartText, defaultStartLocal, checkedInToday, dayClosedToday }: {
  bookingId: string; status: Status; scheduledStartText: string | null; defaultStartLocal: string;
  checkedInToday: boolean; dayClosedToday: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [startLocal, setStartLocal] = useState(defaultStartLocal);
  const [sharing, setSharing] = useState<"on" | "denied" | "off">("off");
  const [farAway, setFarAway] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const lastSent = useRef(0);

  // 10.2a: while On the way, send the phone's position about every 15 seconds. Stops when the page closes or the status changes.
  useEffect(() => {
    if (status !== "on_the_way") return;
    if (!navigator.geolocation) { const timer = window.setTimeout(() => setSharing("denied"), 0); return () => window.clearTimeout(timer); }
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        setSharing("on");
        const now = Date.now();
        if (now - lastSent.current < SHARE_EVERY_MS) return;
        lastSent.current = now;
        void postJson(`/api/bookings/${bookingId}/live`, {
          latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy,
        });
      },
      () => setSharing("denied"),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [status, bookingId]);

  async function run(name: string, action: () => Promise<string | null>) {
    if (busy) return;
    setBusy(name); setError(null); setNotice(null);
    const message = await action();
    setBusy(null);
    if (message) { setError(message); return; }
    router.refresh();
  }

  const confirmSchedule = () => run("schedule", async () => {
    const date = new Date(startLocal);
    if (!startLocal || Number.isNaN(date.getTime())) return "Pick a day and time.";
    return postJson(`/api/bookings/${bookingId}/schedule`, { start: date.toISOString() });
  });

  const goOnTheWay = () => run("travel", async () => {
    try { await getPosition(); } catch { return "Allow location access so your customer can follow you, then try again."; }
    return postJson(`/api/bookings/${bookingId}/travel`, {});
  });

  async function checkIn() {
    if (busy) return;
    setBusy("checkin"); setError(null); setFarAway(null);
    let position: GeolocationPosition;
    try { position = await getPosition(); }
    catch { setBusy(null); setError("Could not get your location. Allow location access and try again at the site."); return; }
    try {
      const response = await fetch("/api/location/arrival", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; distance_m?: number; allowed_radius_m?: number; within_radius?: boolean } | null;
      setBusy(null);
      if (!response.ok) { setError(data?.error ?? "Check in failed. Try again."); return; }
      if (!data?.within_radius) {
        setFarAway(`You are about ${Math.round(data?.distance_m ?? 0)} m from the job address. Move within ${Math.round(data?.allowed_radius_m ?? 200)} m and try again.`);
        return;
      }
      router.refresh();
    } catch { setBusy(null); setError("Could not reach the server. Check your connection and try again."); }
  }

  const askOverride = () => run("override", async () => {
    const message = await postJson("/api/location/arrival/override", { bookingId, reason: overrideReason });
    if (!message) { setNotice("Sent. An admin will review it and let you know."); setOverrideReason(""); }
    return message;
  });

  function pickFiles(list: FileList | null) {
    setError(null);
    const chosen = Array.from(list ?? []);
    if (chosen.length > MAX_PHOTOS) { setError(`Add up to ${MAX_PHOTOS} photos.`); return; }
    if (chosen.some((f) => !EXTENSION[f.type] || f.size > MAX_BYTES)) { setError("Photos must be JPG, PNG or WebP, up to 10 MB each."); return; }
    setFiles(chosen);
  }

  const closeDay = () => run("close", async () => {
    if (files.length < 1) return "Add at least one photo of today's work.";
    const client = createClient();
    const photoPaths: string[] = [];
    for (const file of files) {
      const path = `${bookingId}/${crypto.randomUUID()}.${EXTENSION[file.type]}`;
      const { error: uploadError } = await client.storage.from("proof-photos").upload(path, file, { contentType: file.type });
      if (uploadError) return "A photo could not be uploaded. Try again.";
      photoPaths.push(path);
    }
    return postJson(`/api/bookings/${bookingId}/close-day`, { photoPaths, note });
  });

  return (
    <div className={styles.form}>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      {notice && <StatusMessage status="success">{notice}</StatusMessage>}

      {(status === "deposit_paid" || status === "scheduled") && (
        <>
          <p>{status === "scheduled" && scheduledStartText ? `Scheduled for ${scheduledStartText}.` : "The deposit is paid. Pick the day and time you will arrive."}</p>
          <label htmlFor="schedule-start">{status === "scheduled" ? "Change the day and time" : "Day and time"}</label>
          <input id="schedule-start" type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
          <div className={styles.actions}>
            <Button variant={status === "scheduled" ? undefined : "primary"} loading={busy === "schedule"} disabled={!!busy} onClick={confirmSchedule}>
              {status === "scheduled" ? "Change schedule" : "Confirm schedule"}
            </Button>
            {status === "scheduled" && <Button variant="primary" loading={busy === "travel"} disabled={!!busy} onClick={goOnTheWay}>On the way</Button>}
          </div>
          {status === "scheduled" && <p className={styles.muted}>On the way opens on the day of the job. Your customer will see where you are until you check in.</p>}
        </>
      )}

      {status === "on_the_way" && (
        <>
          {sharing === "denied"
            ? <StatusMessage status="warning">Location sharing is off, so your customer cannot see you. Turn on location access for this site.</StatusMessage>
            : <p className={styles.muted}>Your customer can see where you are until you check in.</p>}
          {farAway && <StatusMessage status="warning">{farAway}</StatusMessage>}
          <div className={styles.actions}>
            <Button variant="primary" loading={busy === "checkin"} disabled={!!busy} onClick={checkIn}>I am at the site. Check in</Button>
          </div>
          {farAway && (
            <>
              <Textarea label="GPS not working? Ask an admin to approve" hint="Say what went wrong. At least 10 characters." value={overrideReason} maxLength={1000} onChange={(e) => setOverrideReason(e.target.value)} />
              <div className={styles.actions}>
                <Button loading={busy === "override"} disabled={!!busy || overrideReason.trim().length < 10} onClick={askOverride}>Send to admin</Button>
              </div>
            </>
          )}
        </>
      )}

      {status === "in_progress" && !checkedInToday && (
        <>
          <p>Check in when you arrive today. You must be within 200 m of the job address.</p>
          {farAway && <StatusMessage status="warning">{farAway}</StatusMessage>}
          <div className={styles.actions}>
            <Button variant="primary" loading={busy === "checkin"} disabled={!!busy} onClick={checkIn}>Check in for today</Button>
          </div>
        </>
      )}

      {status === "in_progress" && checkedInToday && !dayClosedToday && (
        <>
          <p>You are checked in. When you finish for today, close the day with photos of the work.</p>
          <div>
            <label htmlFor="day-photos">Photos of today&apos;s work (1 to {MAX_PHOTOS})</label>
            <input id="day-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => pickFiles(e.target.files)} />
            {files.length > 0 && <ul className={styles.photoList}>{files.map((f) => <li key={f.name + f.size} className={styles.photoName}>{f.name}</li>)}</ul>}
          </div>
          <Textarea label="Note (optional)" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
          <div className={styles.actions}>
            <Button variant="primary" loading={busy === "close"} disabled={!!busy || files.length < 1} disabledReason={files.length < 1 ? "Add at least one photo." : undefined} onClick={closeDay}>Close today</Button>
          </div>
        </>
      )}

      {status === "in_progress" && dayClosedToday && <p>Today is closed. Check in again on your next work day.</p>}
    </div>
  );
}
