"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/public/brand-mark";
import { SIDEBAR_STORAGE_KEY } from "@/lib/sidebar-preference";
import styles from "./shell.module.css";

export function CollapsibleWorkspace({
  sidebar,
  footer,
  children,
  home,
}: {
  sidebar: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  home?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // CSS already uses the preference applied in <head>; hydration only syncs the control.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(document.documentElement.dataset.sidebarCollapsed === "true");
  }, []);

  function toggle() {
    const next = !collapsed;
    document.documentElement.dataset.sidebarCollapsed = String(next);
    setCollapsed(next);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    } catch {
      // The sidebar still works when browser storage is blocked or full.
    }
  }

  const ToggleIcon = collapsed ? ChevronRight : ChevronLeft;

  return (
    <div className={styles.workspace} data-sidebar-collapsed={collapsed}>
      <aside className={styles.roleSidebar} aria-label="Dashboard navigation">
        <div className={styles.sidebarControls}>
          {home && (
            <Link
              href={home}
              className={styles.sidebarBrand}
              data-sidebar-brand
              aria-label="MAZ Plumbing and General Services home"
            >
              <BrandMark />
              <span data-sidebar-label>
                <strong>MAZ</strong>
                <small>
                  Plumbing &amp;
                  <br />
                  General Services
                </small>
              </span>
            </Link>
          )}
          <button
            className={styles.sidebarToggle}
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={`${collapsed ? "Expand" : "Collapse"} sidebar`}
          >
            <ToggleIcon aria-hidden="true" />
          </button>
        </div>
        <div className={styles.sidebarScroll} data-sidebar-scroll-region>
          {sidebar}
        </div>
        <div className={styles.sidebarFooter} data-sidebar-fixed-footer>
          {footer}
        </div>
      </aside>
      {children}
    </div>
  );
}
