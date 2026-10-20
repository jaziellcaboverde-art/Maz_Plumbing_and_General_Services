"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import styles from "./shell.module.css";

export function ShellSettingsLink({ href }: { href: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link className={styles.headerLink} href={href} aria-label="Settings" aria-current={active ? "page" : undefined}>
      <Settings aria-hidden="true" className={styles.headerIcon} />
      <span data-sidebar-label>Settings</span>
    </Link>
  );
}
