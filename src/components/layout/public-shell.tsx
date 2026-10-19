import Link from "next/link";
import styles from "./shell.module.css";

const LEGAL = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Cancellation", href: "/cancellation" },
] as const;

/** Layout shell for guests: logo, Log in, footer (design plan.md wireframe 1). */
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
        <Link className={styles.headerLink} href="/login">
          Log in
        </Link>
      </header>
      <main id="main" className={`${styles.main} ${styles.contentWidth}`}>
        {children}
      </main>
      <footer className={styles.footer}>
        <nav aria-label="Legal">
          <ul className={styles.footerList}>
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link className={styles.footerLink} href={l.href}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </footer>
    </div>
  );
}
