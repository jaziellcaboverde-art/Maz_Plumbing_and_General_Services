import { AuthSplit } from "@/components/auth/auth-split";
import { ResetPasswordForm } from "./reset-password-form";
import styles from "../auth.module.css";

export default function ResetPasswordPage() {
  return (
    <AuthSplit headline="Choose a new password." points={["Use at least 8 characters", "You will log in again with the new password"]}>
      <h1 className={styles.cardTitle}>New password</h1>
      <p className={styles.cardIntro}>Pick a password you do not use anywhere else.</p>
      <ResetPasswordForm />
    </AuthSplit>
  );
}
