import { AuthSplit } from "@/components/auth/auth-split";
import { LoginForm } from "./login-form";
import styles from "../auth.module.css";

export default function LoginPage() {
  return (
    <AuthSplit>
      <h1 className={styles.cardTitle}>Log in</h1>
      <p className={styles.cardIntro}>Continue to your MAZ account.</p>
      <LoginForm />
    </AuthSplit>
  );
}
