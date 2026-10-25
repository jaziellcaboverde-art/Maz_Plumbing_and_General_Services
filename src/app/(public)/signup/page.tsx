import { AuthSplit } from "@/components/auth/auth-split";
import { CustomerSignupForm } from "./signup-form";
import styles from "../auth.module.css";

export default function SignupPage() {
  return (
    <AuthSplit headline="Book home services in a few taps.">
      <h1 className={styles.cardTitle}>Create an account</h1>
      <p className={styles.cardIntro}>Use your account to book plumbing, electrical and general home services.</p>
      <CustomerSignupForm />
    </AuthSplit>
  );
}
