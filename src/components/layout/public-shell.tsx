import Link from "next/link";
import styles from "./shell.module.css";

const LEGAL = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Cancellation", href: "/cancellation" },
] as const;

const GUEST_NAV = [
  { label: "Home", href: "/" },
  { label: "Create a customer account", href: "/signup" },
  { label: "Apply to become a provider", href: "/apply/provider" },
  { label: "Log in", href: "/login" },
] as const;

/** Layout shell for guests: logo, vertical guest navigation and legal links. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <Link className={styles.logo} href="/">
          MAZ Plumbing and General Services
        </Link>
      </header>
      <div className={styles.publicWorkspace}>
        <aside className={styles.publicSidebar}>
          <nav aria-label="Guest navigation">
            <ul className={styles.publicNavList}>
              {GUEST_NAV.map((item) => (
                <li key={item.href}>
                  <Link className={styles.publicNavLink} href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <div className={styles.publicContent}>
          <main id="main" className={`${styles.main} ${styles.contentWidth}`}>
            {children}
          </main>
          <footer className={styles.footer}>
            <nav aria-label="Legal">
              <ul className={styles.footerList}>
                {LEGAL.map((l) => (
                  <li key={l.href}>
                    <Link className={styles.footerLink} href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </footer>
        </div>
      </div>
    </div>
  );
}
