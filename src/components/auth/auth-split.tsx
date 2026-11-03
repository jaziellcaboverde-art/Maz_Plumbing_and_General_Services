import Link from "next/link";
import { Check } from "lucide-react";
import { BrandMark } from "@/components/public/brand-mark";
import styles from "./auth-split.module.css";

type AuthSplitProps = {
  children: React.ReactNode;
  variant?: "login";
  /** Headline on the navy panel. */
  headline?: string;
  points?: readonly string[];
  /** A wider form column for longer forms such as the provider application. */
  wide?: boolean;
};

const DEFAULT_POINTS = [
  "Request plumbing, electrical and general home services",
  "Track your request while our team assigns a qualified provider",
  "Confirm your email with the link we send before logging in",
] as const;

/**
 * Sign in and sign up layout: a navy panel on the left with the MAZ brand and a short promise,
 * the form on the right. On phones the panel sits above the form.
 * Public navigation and the footer remain visible on these routes.
 */
export function AuthSplit({ children, headline = "Your bookings, in one place.", points = DEFAULT_POINTS, wide = false, variant }: AuthSplitProps) {
  return (
    <div className={styles.screen} data-public-fullbleed="true" {...(variant ? { "data-auth-variant": variant } : {})}>
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
              <li key={point}>
                <Check className={styles.pointIcon} aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className={styles.asideFoot}>Plumbing · Electrical · General Services</p>
      </aside>
      <div className={styles.pane}>
        <div className={wide ? `${styles.card} ${styles.cardWide}` : styles.card}>{children}</div>
        <p className={styles.legal}>
          <Link href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link> · <Link href="/terms" target="_blank" rel="noopener noreferrer">Terms</Link>
        </p>
      </div>
    </div>
  );
}
