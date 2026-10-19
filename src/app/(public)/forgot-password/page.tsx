import { ForgotPasswordForm } from "./forgot-password-form";
import styles from "../auth.module.css";

export default function ForgotPasswordPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Reset password</h1>
      <ForgotPasswordForm />
    </div>
  );
}
