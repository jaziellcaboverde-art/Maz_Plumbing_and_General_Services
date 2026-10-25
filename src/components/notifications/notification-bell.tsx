"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Role } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/browser";
import styles from "./notification-bell.module.css";

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

  const refresh = useCallback(async () => {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);

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

  return (
    <Link
      className={styles.link}
      href={`/${role}/notifications`}
      aria-label={label}
      aria-current={pathname === `/${role}/notifications` ? "page" : undefined}
    >
      <Bell aria-hidden="true" className={styles.icon} />
      {unreadCount !== null && unreadCount > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
