import styles from "./page.module.css";

const STEPS = [
  "Tell us what you need",
  "Pick a provider",
  "Pay the deposit",
  "Sign when the job is done",
] as const;

/** Wireframe 1. The two call to action buttons arrive with the Button in step 1.21. */
export default function Home() {
  return (
    <div className={styles.page}>
      <section>
        <h1 className={styles.title}>Book trusted home services near you.</h1>
      </section>
      <section>
        <h2 className={styles.heading}>How it works</h2>
        <ol className={styles.steps}>
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
