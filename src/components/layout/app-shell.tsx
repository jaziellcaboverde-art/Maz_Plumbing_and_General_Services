import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { NAV, type Role } from "./nav-config";
import { RoleNav } from "./role-nav";
import { ShellSettingsLink } from "./shell-settings-link";
import styles from "./shell.module.css";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { LogoutButton } from "@/components/ui/logout-button";
import { createClient } from "@/lib/supabase/server";
import { CollapsibleWorkspace } from "./collapsible-workspace";

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
export async function AppShell({ role, width = "content", children }: Props) {
  // The shell shows who is signed in, so it is built per request. This also stops Next.js 16
  // from complaining that auth reads the clock (Date.now) while it prerenders.
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("first_name,last_name,avatar_path").eq("id", user.id).maybeSingle()
    : { data: null };
  const { data: avatar } = user && profile?.avatar_path
    ? await supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 60 * 60)
    : { data: null };
  const metadata = user?.user_metadata ?? {};
  const firstName = profile?.first_name?.trim() || (typeof metadata.first_name === "string" ? metadata.first_name.trim() : "");
  const lastName = profile?.last_name?.trim() || (typeof metadata.last_name === "string" ? metadata.last_name.trim() : "");
  const roleLabel = role === "admin" ? "Administrator" : role === "provider" ? "Provider" : "Customer";
  const displayName = role === "admin" ? "Admin" : [firstName, lastName].filter(Boolean).join(" ") || roleLabel;
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
        <div className={styles.headerActions}>
          <NotificationBell role={role} />
        </div>
      </header>
      <CollapsibleWorkspace sidebar={
        <>
          <RoleNav role={role} identityName={displayName} identityRole={roleLabel} />
          {role !== "customer" && (
            <div className={styles.sidebarActions}>
              <ShellSettingsLink href={`${NAV[role].home}/settings`} />
            </div>
          )}
          <div className={styles.sidebarAccount}>
            <div className={styles.sidebarAvatar} aria-hidden="true">
              {avatar?.signedUrl ? <Image src={avatar.signedUrl} alt="" fill sizes="2.5rem" unoptimized /> : displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className={styles.sidebarIdentity} data-sidebar-label>
              <strong>{displayName}</strong>
              <span>{roleLabel}</span>
            </div>
            <LogoutButton />
          </div>
        </>
      }>
        <main id="main" className={mainClass}>{children}</main>
      </CollapsibleWorkspace>
    </div>
  );
}
