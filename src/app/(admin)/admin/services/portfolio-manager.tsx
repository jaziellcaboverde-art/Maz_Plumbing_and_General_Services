"use client";

import { useState, type FormEvent } from "react";
import styles from "./portfolio-manager.module.css";

type Photo = { id: string; service_id: string; image_path: string; imageUrl: string; caption: string; sort_order: number };
type Service = { id: string; name: string; category: string };

export function PortfolioManager({ services, initialPhotos }: { services: Service[]; initialPhotos: Photo[] }) {
  const [selected, setSelected] = useState(services[0]?.id ?? "");
  const [photos, setPhotos] = useState(initialPhotos);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const visible = photos.filter((photo) => photo.service_id === selected).sort((a, b) => a.sort_order - b.sort_order);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("serviceId", selected);
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/service-portfolio", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Upload failed.");
      const photo = result.photo;
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      setPhotos((current) => [...current, { ...photo, service_id: selected, imageUrl: `${base}/storage/v1/object/public/service-portfolio/${photo.image_path.split("/").map(encodeURIComponent).join("/")}` }]);
      form.reset(); setMessage("Photo published.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); }
    finally { setBusy(false); }
  }
  async function save(photo: Photo, caption: string, sortOrder: number) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/service-portfolio", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: photo.id, caption, sortOrder }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Update failed.");
      setPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, caption: result.photo.caption, sort_order: result.photo.sort_order } : item));
      setMessage("Photo updated.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed."); }
    finally { setBusy(false); }
  }
  async function remove(photo: Photo) {
    if (busy || !window.confirm("Remove this photo from the public service page?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/service-portfolio", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: photo.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Delete failed.");
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      setMessage("Photo removed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Delete failed."); }
    finally { setBusy(false); }
  }
  return <section className={styles.manager} aria-labelledby="portfolio-title">
    <h2 id="portfolio-title">Completed-work photo portfolio</h2>
    <p>Upload only photos you have permission to publish. These images appear on the visitor and customer service details pages. Customer reviews come from completed bookings and cannot be fabricated here.</p>
    <label className={styles.field}>Service
      <select value={selected} onChange={(event) => { setSelected(event.target.value); setMessage(""); }}>
        {services.map((service) => <option key={service.id} value={service.id}>{service.category} — {service.name}</option>)}
      </select>
    </label>
    {message && <p role="status" className={styles.message}>{message}</p>}
    {selected && <>
      <form onSubmit={upload} className={styles.upload}>
        <label className={styles.field}>Photo (JPG, PNG or WebP, up to 5 MB)
          <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy || visible.length >= 12} />
        </label>
        <label className={styles.field}>Caption
          <input name="caption" maxLength={180} placeholder="e.g. Completed kitchen sink repair" disabled={busy || visible.length >= 12} />
        </label>
        <button type="submit" disabled={busy || visible.length >= 12}>{busy ? "Please wait…" : "Upload photo"}</button>
      </form>
      <p className={styles.count}>{visible.length} of 12 photos</p>
      <div className={styles.grid}>{visible.map((photo) => <PhotoEditor key={photo.id} photo={photo} busy={busy} onSave={save} onRemove={remove} />)}</div>
      {!visible.length && <p>No published photos for this service.</p>}
    </>}
  </section>;
}

function PhotoEditor({ photo, busy, onSave, onRemove }: {
  photo: Photo; busy: boolean; onSave: (photo: Photo, caption: string, sortOrder: number) => Promise<void>; onRemove: (photo: Photo) => Promise<void>;
}) {
  const [caption, setCaption] = useState(photo.caption);
  const [sortOrder, setSortOrder] = useState(photo.sort_order);
  return <form className={styles.photo} onSubmit={(event) => { event.preventDefault(); void onSave(photo, caption, sortOrder); }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={photo.imageUrl} alt={photo.caption || "Portfolio photo"} loading="lazy" />
    <label className={styles.field}>Caption <input value={caption} maxLength={180} onChange={(event) => setCaption(event.target.value)} /></label>
    <label className={styles.field}>Order <input type="number" min={0} max={1000} value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} /></label>
    <div className={styles.actions}><button type="submit" disabled={busy}>Save</button><button type="button" disabled={busy} onClick={() => void onRemove(photo)}>Remove</button></div>
  </form>;
}
