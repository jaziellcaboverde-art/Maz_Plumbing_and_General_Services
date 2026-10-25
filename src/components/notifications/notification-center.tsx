"use client";

import Link from "next/link";
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
};

function internalHref(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function NotificationCenter() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from("notifications")
      .select("id, event, title, body, link, read_at, created_at")
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

  if (loading) return <p className={styles.state} role="status">Loading notifications…</p>;
  if (error && items.length === 0) return <p className={styles.error} role="alert">{error}</p>;
  if (items.length === 0) {
    return <EmptyState title="You’re all caught up" description="New booking and account updates will appear here." />;
  }

  return (
    <section aria-label="Your notifications">
      {error && <p className={styles.error} role="alert">{error}</p>}
      <ul className={styles.list}>
        {items.map((item) => {
          const href = internalHref(item.link);
          const body = item.event === "provider_application.approved"
            ? "Your application was approved and your provider account is active. Open your provider dashboard. You can change your password in Settings."
            : item.body;
          return (
            <li className={`${styles.item} ${item.read_at ? "" : styles.unread}`} key={item.id}>
              <div className={styles.content}>
                {href ? (
                  <Link className={styles.title} href={href}>{item.title}</Link>
                ) : (
                  <h2 className={styles.title}>{item.title}</h2>
                )}
                {body && <p className={styles.body}>{body}</p>}
                <time className={styles.time} dateTime={item.created_at}>
                  {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}
                </time>
              </div>
              {!item.read_at && (
                <button
                  className={styles.markRead}
                  type="button"
                  disabled={savingId === item.id}
                  onClick={() => void markRead(item.id)}
                >
                  {savingId === item.id ? "Saving…" : "Mark as read"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
