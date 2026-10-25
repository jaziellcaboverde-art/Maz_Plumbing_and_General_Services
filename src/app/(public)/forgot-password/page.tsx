import { AuthSplit } from "@/components/auth/auth-split";
import { ForgotPasswordForm } from "./forgot-password-form";
import styles from "../auth.module.css";

export default function ForgotPasswordPage() {
  return (
    <AuthSplit headline="Forgot your password?" points={["Enter your email and we will send a reset link", "The link works once, so use the newest email"]}>
      <h1 className={styles.cardTitle}>Reset password</h1>
      <p className={styles.cardIntro}>We will email you a link to choose a new password.</p>
      <ForgotPasswordForm />
    </AuthSplit>
  );
}
