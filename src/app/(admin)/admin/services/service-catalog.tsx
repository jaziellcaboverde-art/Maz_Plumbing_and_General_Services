"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createClient } from "@/lib/supabase/browser";
import { sortServices } from "@/lib/services/sort";
import styles from "./service-catalog.module.css";

// Built from docs/service-catalog-mockup.html. Keep the two in step.

export type Service = {
  id: string;
  category: string;
  name: string;
  default_class: "minor" | "major";
  urgent_allowed: boolean;
  active: boolean;
  sort_order: number;
  description: string | null;
  starting_price_php: number | null;
  image_path: string | null;
};

export type LogEntry = { id: string; actor: string; action: string; name: string; reason: string | null; at: string };

const peso = (n: number) => "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const time = (iso: string) => new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
const ACTION_WORDS: Record<string, string> = { create: "Added", update: "Edited", deactivate: "Deactivated", activate: "Activated", remove: "Removed" };

async function call(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
  const response = await fetch("/api/admin/services", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? "Something went wrong. Try again.");
  return result;
}

export function ServiceCatalog({ initialServices, photoBase, initialLog }: { initialServices: Service[]; photoBase: string; initialLog: LogEntry[] }) {
  const [services, setServices] = useState(() => sortServices(initialServices));
  const [log, setLog] = useState(initialLog);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [dialog, setDialog] = useState<{ mode: "view" | "edit" | "add"; id: string | null; pickPhoto?: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (text) toastTimer.current = setTimeout(() => setToast(""), 5000);
  };
  const imageUrl = (service: Service) => (service.image_path ? `${photoBase}${service.image_path}` : null);
  const addLog = (action: string, name: string, reason: string | null) =>
    setLog((current) => [{ id: crypto.randomUUID(), actor: "You", action, name, reason, at: new Date().toISOString() }, ...current]);

  // Inactive services always come last (sortServices).
  const ordered = useMemo(() => sortServices(services), [services]);
  const activeNames = ordered.filter((s) => s.active).map((s) => s.name);
  const q = search.trim().toLocaleLowerCase();
  const shown = ordered.filter((s) => `${s.name} ${s.description ?? ""}`.toLocaleLowerCase().includes(q));
  const inactiveCount = services.filter((s) => !s.active).length;
  const current = dialog?.id ? services.find((s) => s.id === dialog.id) ?? null : null;

  function saved(next: Service, action: string, reason: string | null, message: string) {
    setServices((list) => (list.some((s) => s.id === next.id) ? list.map((s) => (s.id === next.id ? next : s)) : [...list, next]));
    addLog(action, next.name, reason);
    say(message);
  }

  return <div className={styles.catalog}>
    <div className={styles.bar}>
      <input className={styles.search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services" aria-label="Search services" autoComplete="off" />
      <button type="button" className={styles.btn} onClick={() => setDialog({ mode: "add", id: null })}>Add service</button>
    </div>
    <p className={styles.toast} role="status">{toast}</p>
    <p className={styles.live}><b>Visitors, customers and providers see (active only):</b> {activeNames.length ? activeNames.join(", ") : "nothing yet"}</p>
    {!services.length && <p>No services yet. Add a service once the launch list is confirmed.</p>}
    {services.length > 0 && !shown.length && <p role="status">No services match your search.</p>}
    <div className={styles.grid}>
      {shown.map((service, index) => <Card
        key={service.id}
        service={service}
        image={imageUrl(service)}
        dividerBefore={!service.active && (index === 0 || shown[index - 1].active) ? inactiveCount : null}
        onOpen={(pickPhoto) => setDialog({ mode: pickPhoto ? "edit" : "view", id: service.id, pickPhoto })}
        onActivated={(next) => saved(next, "activate", null, `${next.name} is active again. It moved back up with the active services.`)}
        onRemoved={(removed, reason) => {
          setServices((list) => list.filter((s) => s.id !== removed.id));
          addLog("remove", removed.name, reason);
          say(`${removed.name} was removed.`);
        }}
      />)}
    </div>
    <details className={styles.log}>
      <summary>Activity log ({log.length})</summary>
      <ul>{log.map((e) => <li key={e.id}><b>{e.actor}</b> · {ACTION_WORDS[e.action] ?? e.action} · {e.name}{e.reason ? ` · reason: ${e.reason}` : ""} · {time(e.at)}</li>)}</ul>
    </details>
    {dialog && <Detail
      key={`${dialog.mode}-${dialog.id ?? "new"}`}
      mode={dialog.mode}
      pickPhoto={Boolean(dialog.pickPhoto)}
      service={current}
      image={current ? imageUrl(current) : null}
      nextOrder={Math.max(0, ...services.map((s) => s.sort_order)) + 1}
      onClose={() => setDialog(null)}
      onSaved={(next, action, reason, message) => { saved(next, action, reason, message); setDialog(null); }}
    />}
  </div>;
}

function Card({ service, image, dividerBefore, onOpen, onActivated, onRemoved }: {
  service: Service; image: string | null; dividerBefore: number | null;
  onOpen: (pickPhoto: boolean) => void; onActivated: (s: Service) => void; onRemoved: (s: Service, reason: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    setBusy(true);
    try { onActivated((await call("PATCH", { id: service.id, active: true })).service); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not activate."); setConfirming(true); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError(null);
    try { await call("DELETE", { id: service.id, reason: why }); onRemoved(service, why.trim()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not remove."); }
    finally { setBusy(false); }
  }
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => { if (e.key === "Enter" && e.target === e.currentTarget && service.active) onOpen(false); };

  return <>
    {dividerBefore !== null && <div className={styles.divider}>Inactive services ({dividerBefore})</div>}
    <div
      className={service.active ? styles.card : `${styles.card} ${styles.off}`}
      tabIndex={0}
      role={service.active ? "button" : "group"}
      aria-label={service.name + (service.active ? "" : " (inactive)")}
      onClick={() => { if (service.active) onOpen(false); }}
      onKeyDown={onKey}
    >
      {!service.active && <>
        <div className={styles.ribbon}>Inactive</div>
        <div className={confirming ? `${styles.offacts} ${styles.keep}` : styles.offacts}>
          {confirming
            ? <div className={styles.confirm} onClick={stop}>
              <span>Remove <b>{service.name}</b> permanently?<br />This cannot be undone.</span>
              <input value={why} maxLength={200} onChange={(e) => setWhy(e.target.value)} placeholder="Reason (required)" aria-label="Reason for removing" />
              {error && <span role="alert">{error}</span>}
              <span className={styles.row2}>
                <button type="button" className={styles.yes} disabled={busy || !why.trim()} onClick={(e) => { stop(e); void remove(); }}>Remove</button>
                <button type="button" onClick={(e) => { stop(e); setConfirming(false); setError(null); setWhy(""); }}>Keep it</button>
              </span>
            </div>
            : <>
              <button type="button" className={styles.act} disabled={busy} onClick={(e) => { stop(e); void activate(); }}>Activate</button>
              <button type="button" className={styles.del} onClick={(e) => { stop(e); setConfirming(true); }}>Remove</button>
            </>}
        </div>
      </>}
      {service.active && <span className={styles.pill}><i />Active</span>}
      {image
        ? <div className={styles.banner} style={{ backgroundImage: `url('${image}')` }} role="img" aria-label={`${service.name} photo`} />
        : <button type="button" className={styles.plus} aria-label={`Upload a photo for ${service.name}`} onClick={(e) => { stop(e); onOpen(true); }}>+</button>}
      <div className={styles.cbody}>
        <div className={styles.name}>{service.name}</div>
        <p className={styles.desc}>{service.description}</p>
        {service.starting_price_php !== null && <span className={styles.badge}>From {peso(service.starting_price_php)}</span>}
      </div>
    </div>
  </>;
}

function Detail({ mode, pickPhoto, service, image, nextOrder, onClose, onSaved }: {
  nextOrder: number; mode: "view" | "edit" | "add"; pickPhoto: boolean; service: Service | null; image: string | null;
  onClose: () => void; onSaved: (s: Service, action: string, reason: string | null, message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const adding = mode === "add";
  const [editing, setEditing] = useState(mode !== "view");
  const [name, setName] = useState(service?.name ?? "");
  const [desc, setDesc] = useState(service?.description ?? "");
  const [price, setPrice] = useState(service?.starting_price_php !== null && service?.starting_price_php !== undefined ? String(service.starting_price_php) : "");
  const [active, setActive] = useState(service ? service.active : true);
  const [reason, setReason] = useState("");
  const [cat, setCat] = useState(service?.category ?? "");
  const [cls, setCls] = useState<"minor" | "major">(service?.default_class ?? "minor");
  const [urg, setUrg] = useState(service?.urgent_allowed ?? false);
  const [ord, setOrd] = useState(service ? String(service.sort_order) : String(nextOrder));
  const [menu, setMenu] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { ref.current?.showModal(); if (pickPhoto) fileRef.current?.click(); }, [pickPhoto]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const needReason = !adding && editing && service?.active === true && !active;
  const changed = adding || Boolean(service && (name !== service.name || desc !== (service.description ?? "") || (price === "" ? null : Number(price)) !== service.starting_price_php || active !== service.active || (cat.trim() || name.trim()) !== service.category || cls !== service.default_class || urg !== service.urgent_allowed || Number(ord) !== service.sort_order || file));
  const complete = name.trim() !== "" && desc.trim() !== "" && (!adding ? true : price !== "") && (price === "" || Number(price) >= 0) && ord !== "" && Number(ord) >= 0 && Number.isInteger(Number(ord));
  const reasonOk = !needReason || reason.trim() !== "";
  const hero = preview ?? image;

  function pick(chosen: File | undefined) {
    if (!chosen) return;
    if (!/^image\/(jpeg|png|webp)$/.test(chosen.type)) { setNote("Choose a JPG, PNG or WebP picture."); return; }
    if (chosen.size > 5 * 1024 * 1024) { setNote("That picture is over 5 MB. Choose a smaller one."); return; }
    setFile(chosen); setPreview(URL.createObjectURL(chosen)); setNote("New photo ready. Save to keep it.");
    if (!adding) setEditing(true);
  }
  function upload() {
    if (file) { setFile(null); setPreview(null); setNote("Upload cancelled."); return; }
    if (!adding && !editing) setEditing(true);
    fileRef.current?.click();
  }

  async function save() {
    if (busy || !complete || !reasonOk) return;
    setBusy(true); setNote("");
    let uploaded: string | null = null;
    try {
      if (file) {
        const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        uploaded = `catalog/${crypto.randomUUID()}.${ext}`;
        const { error } = await createClient().storage.from("service-photos").upload(uploaded, file, { contentType: file.type, cacheControl: "3600" });
        if (error) { uploaded = null; throw new Error("The photo could not be uploaded. Try again."); }
      }
      const body: Record<string, unknown> = { name, description: desc, startingPrice: price === "" ? null : Number(price), active, category: cat.trim() || name.trim(), defaultClass: cls, urgentAllowed: urg, sortOrder: Number(ord) };
      if (uploaded) body.imagePath = uploaded;
      if (adding) {
        const { service: made } = await call("POST", body);
        onSaved(made, "create", null, `"${made.name}" added.` + (made.active ? " Customers and providers were both notified about the new service. Providers are asked if it is part of their expertise." : " It is inactive, so nobody sees it yet."));
      } else if (service) {
        const { service: next } = await call("PATCH", { id: service.id, ...body, reason: needReason ? reason : undefined });
        const deactivated = service.active && !next.active;
        onSaved(next, deactivated ? "deactivate" : !service.active && next.active ? "activate" : "update", deactivated ? reason.trim() : null,
          `"${next.name}" saved.` + (next.active ? "" : " It is hidden from visitors, customers and providers and moved to the end of the list."));
      }
    } catch (caught) {
      if (uploaded) await createClient().storage.from("service-photos").remove([uploaded]);
      setNote(caught instanceof Error ? caught.message : "Could not save the service.");
    } finally { setBusy(false); }
  }

  const showSave = !adding && editing && changed;
  return <dialog
    ref={ref}
    className={styles.dialog}
    aria-label="Service details"
    onClose={onClose}
    onCancel={(e) => { if (menu) { e.preventDefault(); setMenu(false); } }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); else if (!(e.target as HTMLElement).closest("[data-dd]")) setMenu(false); }}
  >
    <div className={styles.hero} style={hero ? { backgroundImage: `url('${hero}')` } : undefined}>
      <button type="button" className={styles.back} onClick={onClose} aria-label="Close">✕</button>
      <button type="button" className={styles.uploadchip} onClick={upload}>{file ? "Cancel upload" : "Upload photo"}</button>
    </div>
    <div className={styles.body}>
      <div className={styles.row}><label htmlFor="svc-name">Service name</label>
        {editing ? <input id="svc-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /> : <div className={styles.v}>{service?.name}</div>}</div>
      <div className={styles.row}><label htmlFor="svc-desc">Description</label>
        {editing ? <textarea id="svc-desc" rows={4} value={desc} maxLength={400} onChange={(e) => setDesc(e.target.value)} /> : <div className={styles.v}>{service?.description}</div>}</div>
      <div className={styles.two}>
        <div className={styles.row}><label htmlFor="svc-price">Estimated starting rate (PHP)</label>
          {editing ? <input id="svc-price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /> : <div className={styles.v}>{service?.starting_price_php != null ? peso(service.starting_price_php) : "Not set"}</div>}
          <span className={styles.hint}>Visitors see &quot;final price after inspection&quot;.</span></div>
        <div className={styles.row}><label>Status</label>
          {editing
            ? <div className={styles.dd} data-dd>
              <button type="button" className={styles.ddbtn} aria-haspopup="listbox" aria-expanded={menu} onClick={() => setMenu(!menu)}>
                <span><span className={active ? `${styles.dot} ${styles.on}` : styles.dot} />{active ? "Active" : "Inactive"}</span><span aria-hidden="true">▾</span></button>
              {menu && <ul className={styles.ddmenu} role="listbox">
                <li role="option" aria-selected={active} onClick={() => { setActive(true); setMenu(false); }}><span className={`${styles.dot} ${styles.on}`} />Active</li>
                <li role="option" aria-selected={!active} onClick={() => { setActive(false); setMenu(false); }}><span className={styles.dot} />Inactive</li>
              </ul>}
            </div>
            : <div className={styles.v}><span className={service?.active ? `${styles.dot} ${styles.on}` : styles.dot} />{service?.active ? "Active" : "Inactive"}</div>}</div>
      </div>
      {editing && <div className={styles.jobset}>
        <h3>Job settings</h3>
        <div className={styles.two}>
          <div className={styles.row}><label htmlFor="svc-cls">Job class</label>
            <select id="svc-cls" value={cls} onChange={(e) => setCls(e.target.value as "minor" | "major")}>
              <option value="minor">Minor repair (one full payment)</option>
              <option value="major">Major project (contract + 50/50 payment)</option>
            </select></div>
          <div className={styles.row}><label htmlFor="svc-ord">Display order</label>
            <input id="svc-ord" type="number" min="0" step="1" value={ord} onChange={(e) => setOrd(e.target.value)} /></div>
        </div>
        <div className={styles.row}><label htmlFor="svc-cat">Category</label>
          <input id="svc-cat" value={cat} maxLength={80} placeholder="Defaults to the service name" onChange={(e) => setCat(e.target.value)} /></div>
        <label className={styles.chk}><input type="checkbox" checked={urg} onChange={(e) => setUrg(e.target.checked)} /> Allow urgent / same-day requests</label>
        {!adding && service && cls !== service.default_class && <span className={styles.hint}>Changing the class applies to new bookings only. Bookings already made keep their class.</span>}
        <span className={styles.hint}>Display order only sorts inside the active group and inside the inactive group. Inactive services always come last.</span>
      </div>}
      {needReason && <div className={styles.row}><label htmlFor="svc-reason">Reason for deactivating <span className={styles.req}>*</span></label>
        <input id="svc-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="For example: no provider for this service this month" />
        <span className={styles.hint}>Required. Saved in the activity log. Inactive services are hidden from visitors, customers and providers.</span></div>}
      {note && <p className={styles.toast} role="alert">{note}</p>}
      {needReason && !reason.trim() && <p className={styles.hint}>Type a reason above to enable Save changes.</p>}
      <div className={styles.actions}>
        {adding && <button type="button" className={styles.btn} disabled={!complete || busy} onClick={() => void save()}>Add service</button>}
        {!adding && !showSave && <button type="button" className={styles.btn} disabled={editing} onClick={() => setEditing(true)}>Edit</button>}
        {showSave
          ? <button type="button" className={styles.btn} disabled={busy || !complete || !reasonOk} onClick={() => void save()}>Save changes</button>
          : <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={onClose}>Cancel</button>}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  </dialog>;
}
