"use client";

import Link from "next/link";
import { BriefcaseBusiness, CreditCard, Megaphone } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/browser";
import { notifyNotificationChange } from "./notification-bell";
import styles from "./notification-center.module.css";

type Notification = {
  id: string;
  event: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  category: "booking" | "account" | "announcement";
  dismissed_at: string | null;
  requires_ack: boolean;
  acknowledged_at: string | null;
};

function internalHref(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}

export function NotificationCenter() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "bookings" | "announcements">("all");
  const [savingAll, setSavingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from("notifications")
      .select("id,event,title,body,link,read_at,created_at,category,dismissed_at,requires_ack,acknowledged_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (queryError) {
      setError("Notifications could not be loaded. Refresh the page to try again.");
    } else {
      setItems((data ?? []) as Notification[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

  async function markRead(id: string) {
    setSavingId(id);
    setError(null);
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .is("read_at", null);

    if (updateError) {
      setError("This notification could not be marked as read. Try again.");
    } else {
      setItems((current) => current.map((item) =>
        item.id === id ? { ...item, read_at: new Date().toISOString() } : item,
      ));
      notifyNotificationChange();
    }
    setSavingId(null);
  }

  const visibleItems = items.filter((item) => !item.dismissed_at
    && (tab === "all" || (tab === "announcements" ? item.category === "announcement" : item.category === "booking")));

  async function markAllRead() {
    setSavingAll(true);
    setError(null);
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase.from("notifications").update({ read_at: readAt })
      .is("read_at", null).is("dismissed_at", null);
    if (updateError) setError("Notifications could not be marked as read. Try again.");
    else {
      setItems((current) => current.map((item) => item.dismissed_at || item.read_at ? item : { ...item, read_at: readAt }));
      notifyNotificationChange();
    }
    setSavingAll(false);
  }

  async function updateAnnouncement(item: Notification, action: "dismiss" | "acknowledge") {
    setSavingId(item.id);
    setError(null);
    const now = new Date().toISOString();
    const patch = action === "acknowledge"
      ? { acknowledged_at: now, read_at: item.read_at ?? now }
      : { dismissed_at: now, read_at: item.read_at ?? now };
    const { error: updateError } = await supabase.from("notifications").update(patch).eq("id", item.id);
    if (updateError) setError(action === "dismiss" ? "This announcement could not be dismissed." : "This announcement could not be acknowledged.");
    else {
      setItems((current) => current.map((row) => {
        if (row.id !== item.id) return row;
        if (action === "acknowledge") return { ...row, acknowledged_at: now, read_at: row.read_at ?? now };
        return { ...row, dismissed_at: now, read_at: row.read_at ?? now };
      }));
      notifyNotificationChange();
    }
    setSavingId(null);
  }

  if (loading) return <p className={styles.state} role="status">Loading notifications…</p>;

  return (
    <section aria-label="Your notifications">
      {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>}
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="group" aria-label="Notification category">
          {(["all", "bookings", "announcements"] as const).map((choice) => <button
            key={choice}
            type="button"
            aria-pressed={tab === choice}
            className={tab === choice ? styles.activeTab : ""}
            onClick={() => setTab(choice)}
          >{choice === "all" ? "All" : choice === "bookings" ? "Bookings" : "Announcements"}</button>)}
        </div>
        {items.some((item) => !item.read_at && !item.dismissed_at) && <button className={styles.markAll}
          type="button" disabled={savingAll} onClick={() => void markAllRead()}>
          {savingAll ? "Saving…" : "Mark all as read"}
        </button>}
      </div>
      {!visibleItems.length ? <EmptyState title={tab === "announcements" ? "No announcements" : "You’re all caught up"}
        description={tab === "announcements" ? "Platform updates will appear here." : "New booking and account updates will appear here."} /> :
      <ul className={styles.list}>
        {visibleItems.map((item) => {
          const href = internalHref(item.link);
          const body = item.event === "provider_application.approved"
            ? "Your application was approved and your provider account is active. Open your provider dashboard. You can change your password in Settings."
            : item.body;
          const Icon = item.category === "announcement" ? Megaphone : /payment|deposit/i.test(`${item.event} ${item.title}`) ? CreditCard : BriefcaseBusiness;
          return (
            <li className={`${styles.item} ${item.read_at ? "" : styles.unread} ${item.category === "announcement" ? styles.announcement : ""}`} key={item.id}>
              <Icon className={styles.icon} aria-hidden="true" />
              <div className={styles.content}>
                {href ? (
                  <Link className={styles.title} href={href}>{item.title}</Link>
                ) : (
                  <h2 className={styles.title}>{item.title}</h2>
                )}
                {body && <p className={styles.body}>{body}</p>}
                {item.category === "announcement" && href && <Link className={styles.learnMore} href={href}>Learn more</Link>}
                <div className={styles.meta}>
                  <span>{item.category === "announcement" ? "Announcement" : item.category === "booking" ? "Booking" : "Account"}</span>
                  <time className={styles.time} dateTime={item.created_at}>{relativeTime(item.created_at)}</time>
                </div>
              </div>
              <div className={styles.actions}>
              {item.category === "announcement" && item.requires_ack && !item.acknowledged_at && <button
                className={styles.markRead} type="button" disabled={savingId === item.id}
                onClick={() => void updateAnnouncement(item, "acknowledge")}>
                {savingId === item.id ? "Saving…" : "Acknowledge"}
              </button>}
              {item.category === "announcement" && (!item.requires_ack || item.acknowledged_at) && <button
                className={styles.markRead} type="button" disabled={savingId === item.id}
                onClick={() => void updateAnnouncement(item, "dismiss")}>
                {savingId === item.id ? "Saving…" : "Dismiss"}
              </button>}
              {item.category !== "announcement" && !item.read_at && (
                <button
                  className={styles.markRead}
                  type="button"
                  disabled={savingId === item.id}
                  onClick={() => void markRead(item.id)}
                >
                  {savingId === item.id ? "Saving…" : "Mark as read"}
                </button>
              )}
              </div>
            </li>
          );
        })}
      </ul>
      }
    </section>
  );
}

function relativeTime(value: string) {
  const elapsed = (new Date(value).getTime() - Date.now()) / 1000;
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400],
    ["hour", 3600], ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const match = units.find(([, threshold]) => Math.abs(elapsed) >= threshold);
  const unit = match?.[0] ?? "second";
  const seconds = match?.[1] ?? 1;
  return formatter.format(Math.round(elapsed / seconds), unit);
}
