"use client";

import { useEffect, useState } from "react";
import styles from "@/components/quotes/quotes.module.css";

type Spot = { latitude: number; longitude: number; updatedAt: string };

function agoText(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
}

/** 10.2a: the customer follows the provider while the booking is on the way. Nothing is kept after check in. */
export function LiveTracker({ bookingId }: { bookingId: string }) {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const response = await fetch(`/api/bookings/${bookingId}/live`, { cache: "no-store" });
        const data = (await response.json()) as { location: Spot | null };
        if (!stopped) { setSpot(data.location); setLoaded(true); setNow(Date.now()); }
      } catch { if (!stopped) setLoaded(true); }
    }
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [bookingId]);

  const stale = spot ? now - new Date(spot.updatedAt).getTime() > 3 * 60 * 1000 : false;
  const d = 0.004;
  const embed = spot
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${spot.longitude - d},${spot.latitude - d},${spot.longitude + d},${spot.latitude + d}&layer=mapnik&marker=${spot.latitude},${spot.longitude}`
    : null;

  return (
    <div className={styles.card}>
      <span className={styles.title}>Your provider is on the way</span>
      {!loaded && <p className={styles.muted}>Looking for your provider&apos;s location…</p>}
      {loaded && !spot && <p className={styles.muted}>Their location is not shared yet. This updates when their phone sends it.</p>}
      {spot && embed && (
        <>
          <iframe title="Where your provider is now" src={embed} loading="lazy" className={styles.mapFrame} />
          <p className={styles.muted}>Updated {agoText(spot.updatedAt, now)}.{stale ? " The signal may be weak. The spot shown is the last one we received." : ""}</p>
          <a href={`https://www.openstreetmap.org/?mlat=${spot.latitude}&mlon=${spot.longitude}#map=16/${spot.latitude}/${spot.longitude}`} target="_blank" rel="noreferrer">Open in a bigger map</a>
        </>
      )}
    </div>
  );
}
