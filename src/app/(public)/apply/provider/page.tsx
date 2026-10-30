import Link from "next/link";
import { AuthSplit } from "@/components/auth/auth-split";
import { ProviderSignupForm } from "./signup-form";
import styles from "../../auth.module.css";

export default function ProviderSignupPage() {
  return (
    <AuthSplit
      wide
      headline="Work with MAZ Plumbing."
      points={[
        "Create an account and submit your details for review",
        "Upload your ID, a selfie, an NBI clearance and proof of address. Only admins can view them",
        "Once approved, receive job offers near you",
      ]}
    >
      <h1 className={styles.cardTitle}>Apply as a provider</h1>
      <p className={styles.cardIntro}>Create an account first. After confirming your email, you can submit your service details and required documents for admin review.</p>
      <section className={styles.steps} aria-label="How it works">
        <h2>How it works</h2>
        <ol>
          <li>Create your account and confirm your email.</li>
          <li>Submit your details and documents.</li>
          <li>An admin reviews them. You can start taking jobs once approved.</li>
        </ol>
        <details>
          <summary>Documents to have ready</summary>
          <p>A government ID, a selfie holding your ID, an NBI clearance, a barangay clearance or recent bill, two references, and optionally a TESDA or skills certificate.</p>
        </details>
      </section>
      <ProviderSignupForm />
      <div className={styles.cardFooter}>
        <span>Already have an account? <Link href="/login">Log in</Link></span>
      </div>
    </AuthSplit>
  );
}
