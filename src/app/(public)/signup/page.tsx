import Link from "next/link";
import { CustomerSignupForm } from "./signup-form";
import styles from "../auth.module.css";

export default function SignupPage() {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Create a customer account</h1>
      <p>Use your account to book plumbing, electrical, and general home services.</p>
      <CustomerSignupForm />
      <p><Link href="/login">Already have an account? Log in</Link></p>
    </section>
  );
}
