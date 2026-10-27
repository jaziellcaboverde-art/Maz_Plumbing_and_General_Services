"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Megaphone } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Role } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/browser";
import styles from "./notification-bell.module.css";

type RecentNotification = { id: string; title: string; body: string | null; link: string | null; category: string; created_at: string };
const NOTIFICATIONS_CHANGED = "capstone:notifications-changed";

export function notifyNotificationChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  }
}

export function NotificationBell({ role }: { role: Role }) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<RecentNotification[]>([]);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const refresh = useCallback(async () => {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .is("dismissed_at", null);

    if (!error) setUnreadCount(count ?? 0);
  }, [supabase]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener(NOTIFICATIONS_CHANGED, onFocus);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(NOTIFICATIONS_CHANGED, onFocus);
    };
  }, [pathname, refresh]);

  const label = unreadCount === null
    ? "Notifications"
    : `Notifications, ${unreadCount} unread`;

  async function loadRecent() {
    setLoadingRecent(true);
    setRecentError(null);
    const { data, error } = await supabase.from("notifications")
      .select("id,title,body,link,category,created_at")
      .is("dismissed_at", null).order("created_at", { ascending: false }).limit(5);
    if (error) setRecentError("Recent notifications could not be loaded.");
    else setRecent((data ?? []) as RecentNotification[]);
    setLoadingRecent(false);
  }

  async function toggleRecent() {
    if (window.matchMedia("(max-width: 48rem)").matches) return;
    if (open) { setOpen(false); return; }
    setOpen(true);
    await loadRecent();
  }

  function internalHref(value: string | null) {
    return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
      ? value : `/${role}/notifications`;
  }

  return (
    <div className={styles.wrap}>
      <Link
        className={styles.link}
        href={`/${role}/notifications`}
        aria-label={label}
        aria-current={pathname === `/${role}/notifications` ? "page" : undefined}
        onClick={(event) => {
          if (!window.matchMedia("(max-width: 48rem)").matches) {
            event.preventDefault();
            void toggleRecent();
          }
        }}
        aria-expanded={open}
      >
        <Bell aria-hidden="true" className={styles.icon} />
        {unreadCount !== null && unreadCount > 0 && (
          <span className={styles.badge} aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </Link>
      {open && <div className={styles.popover} role="dialog" aria-label="Recent notifications">
        <strong>Recent notifications</strong>
        {loadingRecent ? <p role="status">Loading…</p> : recentError ? <p role="alert">{recentError}</p> :
          recent.length ? <ul>{recent.map((item) => <li key={item.id}>
            <Link href={internalHref(item.link)}
              onClick={() => setOpen(false)}>
              <span>{item.category === "announcement" && <Megaphone size={14} aria-hidden="true" />} {item.title}</span>
              {item.body && <small>{item.body}</small>}
            </Link>
          </li>)}</ul> : <p>You’re all caught up.</p>}
        {recentError && <button className={styles.retry} type="button" onClick={() => void loadRecent()}>Retry</button>}
        <Link className={styles.seeAll} href={`/${role}/notifications`} onClick={() => setOpen(false)}>See all</Link>
      </div>}
    </div>
  );
}
