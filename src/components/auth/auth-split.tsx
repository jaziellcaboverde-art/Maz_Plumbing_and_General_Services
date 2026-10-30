import Link from "next/link";
import { BrandMark } from "@/components/public/brand-mark";
import styles from "./auth-split.module.css";

type AuthSplitProps = {
  children: React.ReactNode;
  /** Headline on the navy panel. */
  headline?: string;
  points?: readonly string[];
  /** A wider form column for longer forms such as the provider application. */
  wide?: boolean;
};

const DEFAULT_POINTS = [
  "Request plumbing, electrical and general home services",
  "Choose an approved provider and track your job",
  "Confirm your email with the link we send before logging in",
] as const;

/**
 * Sign in and sign up layout: a navy panel on the left with the MAZ brand and a short promise,
 * the form on the right. On phones the panel sits above the form. The data-login-screen mark
 * makes the guest shell hide its header and footer for these pages.
 */
export function AuthSplit({ children, headline = "Your bookings, in one place.", points = DEFAULT_POINTS, wide = false }: AuthSplitProps) {
  return (
    <div className={styles.screen} data-login-screen="true">
      <aside className={styles.aside} aria-label="MAZ Plumbing and General Services">
        <Link className={styles.brand} href="/">
          <span className={styles.brandMark}><BrandMark priority /></span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>MAZ Plumbing</span>
            <span className={styles.brandSub}>and General Services</span>
          </span>
        </Link>
        <div className={styles.copy}>
          <h2 className={styles.headline}>{headline}</h2>
          <ul className={styles.points}>
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
        <p className={styles.asideFoot}>Plumbing · Electrical · General Services</p>
      </aside>
      <div className={styles.pane}>
        <div className={wide ? `${styles.card} ${styles.cardWide}` : styles.card}>{children}</div>
        <p className={styles.legal}>
          <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms</Link>
        </p>
      </div>
    </div>
  );
}
