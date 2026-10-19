import { LoginForm } from "./login-form";
import styles from "../auth.module.css";

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Log in</h1>
      <LoginForm />
    </div>
  );
}
