import { LoginForm } from "./login-form";
import styles from "../auth.module.css";
import Image from "next/image";

export default function LoginPage() {
  return (
    <div className={styles.loginScreen} data-login-screen="true">
      <aside className={styles.loginArtwork} aria-label="MAZ Plumbing and General Services">
        <div className={styles.brand}>
          <Image
            className={styles.brandLogo}
            src="/maz-plumbing-logo.jpg"
            alt="MAZ Plumbing and General Services logo"
            width={180}
            height={180}
            priority
          />
          <span className={styles.brandName}>MAZ Plumbing<br />and General Services</span>
        </div>
        <div className={styles.artworkCopy}>
          <p className={styles.eyebrow}>Reliable help for your home</p>
          <h2>Service you can count on.</h2>
          <p>Sign in to manage your bookings and keep your home services moving.</p>
        </div>
        <p className={styles.artworkFooter}>Plumbing · Electrical · General Services</p>
      </aside>
      <section className={styles.loginPanel}>
        <div className={styles.loginContent}>
          <h1 className={styles.loginTitle}>Welcome back</h1>
          <p className={styles.loginIntro}>Log in to your MAZ account.</p>
          <LoginForm />
        </div>
      </section>
    </div>
  );
}
