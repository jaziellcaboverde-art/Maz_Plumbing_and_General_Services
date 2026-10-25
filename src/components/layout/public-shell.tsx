import Link from "next/link";
import { Clock, Globe, Mail, MapPin, Phone } from "lucide-react";
import { BrandMark } from "@/components/public/brand-mark";
import { BUSINESS } from "@/lib/public/business-info";
import styles from "./public-shell.module.css";

const NAV = [
  { label: "Services", href: "/#services" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Contact", href: "/#contact" },
] as const;

const QUICK_LINKS = [
  { label: "Services", href: "/#services" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Create a customer account", href: "/signup" },
  { label: "Apply to become a provider", href: "/apply/provider" },
] as const;

const HELP_LINKS = [
  { label: "Log in", href: "/login" },
  { label: "Forgot password", href: "/forgot-password" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Cancellation", href: "/cancellation" },
] as const;

/**
 * Layout shell for guests: top navigation, page content and a footer with links and contact details.
 * Sign in and sign up screens mark themselves with data-login-screen and take the whole window.
 */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <Link className={styles.logo} href="/">
          <span className={styles.logoMark}>
            <BrandMark />
          </span>
          <span className={styles.logoText}>MAZ Plumbing and General Services</span>
        </Link>
        <nav className={styles.nav} aria-label="Guest navigation">
          <ul className={styles.navList}>
            {NAV.map((item) => (
              <li key={item.href}>
                <Link className={styles.navLink} href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.actions}>
          <Link className={styles.loginLink} href="/login">Log in</Link>
          <Link className={styles.signupLink} href="/signup">Sign up</Link>
        </div>
      </header>
      <main id="main" className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <p className={styles.footerName}>{BUSINESS.name}</p>
            <p className={styles.footerText}>{BUSINESS.tagline}</p>
          </div>
          <nav aria-labelledby="footer-quick">
            <h2 id="footer-quick" className={styles.footerHeading}>Quick links</h2>
            <ul className={styles.footerList}>
              {QUICK_LINKS.map((item) => (
                <li key={item.href}><Link className={styles.footerLink} href={item.href}>{item.label}</Link></li>
              ))}
            </ul>
          </nav>
          <nav aria-labelledby="footer-help">
            <h2 id="footer-help" className={styles.footerHeading}>Help</h2>
            <ul className={styles.footerList}>
              {HELP_LINKS.map((item) => (
                <li key={item.href}><Link className={styles.footerLink} href={item.href}>{item.label}</Link></li>
              ))}
            </ul>
          </nav>
          <section id="contact" aria-labelledby="footer-visit">
            <h2 id="footer-visit" className={styles.footerHeading}>Visit us</h2>
            <ul className={styles.contactList}>
              <li><MapPin className={styles.contactIcon} aria-hidden="true" /><span>{BUSINESS.address ?? `Serving ${BUSINESS.serviceArea}`}</span></li>
              {BUSINESS.hours && (
                <li>
                  <Clock className={styles.contactIcon} aria-hidden="true" />
                  <span>{BUSINESS.hours}{BUSINESS.hoursNote && <><br />{BUSINESS.hoursNote}</>}</span>
                </li>
              )}
              {BUSINESS.phones.map((phone) => (
                <li key={phone}><Phone className={styles.contactIcon} aria-hidden="true" /><a className={styles.footerLink} href={`tel:${phone.replace(/\D/g, "")}`}>{phone}</a></li>
              ))}
              {BUSINESS.email && <li><Mail className={styles.contactIcon} aria-hidden="true" /><a className={styles.footerLink} href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a></li>}
              {BUSINESS.facebook && <li><Globe className={styles.contactIcon} aria-hidden="true" /><a className={styles.footerLink} href={BUSINESS.facebook.href} target="_blank" rel="noopener noreferrer">{BUSINESS.facebook.label}</a></li>}
            </ul>
          </section>
        </div>
        <p className={styles.copyright}>© {BUSINESS.copyrightYear} {BUSINESS.name}. All rights reserved.</p>
      </footer>
    </div>
  );
}
