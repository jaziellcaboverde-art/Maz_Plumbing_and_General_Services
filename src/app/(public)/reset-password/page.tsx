import { ResetPasswordForm } from "./reset-password-form";
import styles from "../auth.module.css";

export default function ResetPasswordPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>New password</h1>
      <ResetPasswordForm />
    </div>
  );
}
