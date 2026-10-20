import Link from "next/link";
import { ProviderSignupForm } from "./signup-form";
import styles from "../../auth.module.css";

export default function ProviderSignupPage() {
  return (
    <section className={styles.page}>
      <h1>Apply to become a provider</h1>
      <p>Create an account first. After confirming your email, you can submit your service details and required documents for admin review.</p>
      <ProviderSignupForm />
      <p><Link href="/login">Already have an account? Log in</Link></p>
    </section>
  );
}
