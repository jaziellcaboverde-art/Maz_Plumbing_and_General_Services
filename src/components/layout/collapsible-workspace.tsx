"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import styles from "./shell.module.css";

const STORAGE_KEY = "maz-sidebar-collapsed";

export function CollapsibleWorkspace({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Read after mount so the server and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  function toggle() {
    setCollapsed((current) => !current);
  }

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div className={styles.workspace} data-sidebar-collapsed={collapsed}>
      <aside className={styles.roleSidebar} aria-label="Dashboard navigation">
        <div className={styles.sidebarControls}>
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
        <div className={styles.sidebarScroll}>{sidebar}</div>
      </aside>
      {children}
    </div>
  );
}
