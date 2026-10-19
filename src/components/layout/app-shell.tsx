import Link from "next/link";
import { Settings } from "lucide-react";
import { NAV, type Role } from "./nav-config";
import { RoleNav } from "./role-nav";
import styles from "./shell.module.css";
import { NotificationBell } from "@/components/notifications/notification-bell";

type Props = {
  role: Role;
  /** Admin tables use the full width. Customer and provider use the content width. */
  width?: "content" | "full";
  children: React.ReactNode;
};

/**
 * Layout shell for the three signed in roles (step 1.20).
 * Header, nav and the skip link live here so they never change between pages.
 * Route guards are Phase 2. This shell does not check who is signed in.
 */
export function AppShell({ role, width = "content", children }: Props) {
  const mainClass = [
    styles.main,
    styles.withTabs,
    width === "content" ? styles.contentWidth : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <Link className={styles.logo} href={NAV[role].home}>
          MAZ Plumbing and General Services
        </Link>
        <RoleNav role={role} />
        <NotificationBell role={role} />
        {role !== "customer" && (
          <Link
            className={styles.headerLink}
            href={`${NAV[role].home}/settings`}
            aria-label="Settings"
          >
            <Settings aria-hidden="true" className={styles.headerIcon} />
          </Link>
        )}
      </header>
      <main id="main" className={mainClass}>
        {children}
      </main>
    </div>
  );
}
