import Link from "next/link";
import { AuthSplit } from "@/components/auth/auth-split";
import { ProviderSignupForm } from "./signup-form";
import styles from "../../auth.module.css";

export default function ProviderSignupPage() {
  return (
    <AuthSplit
      headline="Work with MAZ Plumbing."
      points={[
        "Create an account and submit your details for review",
        "Upload your ID and a selfie. Only admins can view them",
        "Once approved, receive job offers near you",
      ]}
    >
      <h1 className={styles.cardTitle}>Apply as a provider</h1>
      <p className={styles.cardIntro}>Create an account first. After confirming your email, you can submit your service details and required documents for admin review.</p>
      <ProviderSignupForm />
      <div className={styles.cardFooter}>
        <span>Already have an account? <Link href="/login">Log in</Link></span>
      </div>
    </AuthSplit>
  );
}
