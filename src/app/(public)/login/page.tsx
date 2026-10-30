import { AuthSplit } from "@/components/auth/auth-split";
import { LoginForm } from "./login-form";
import styles from "../auth.module.css";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google } = await searchParams;
  return (
    <AuthSplit>
      <h1 className={styles.cardTitle}>Log in</h1>
      <p className={styles.cardIntro}>Continue to your MAZ account.</p>
      <LoginForm googleFailed={google === "failed"} />
    </AuthSplit>
  );
}
