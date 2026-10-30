import { BadgeCheck, ClipboardList, CreditCard, PenLine, ShieldCheck, Users } from "lucide-react";
import styles from "./how-it-works.module.css";

export const STEPS = [
  { title: "Tell us what you need", text: "Choose a service, describe the job, add photos and pin your address.", icon: ClipboardList },
  { title: "Pick a provider", text: "See approved providers near you in a ranked list and choose one.", icon: Users },
  { title: "Pay the deposit", text: "Pay the deposit through the system to reserve your job.", icon: CreditCard },
  { title: "Sign when the job is done", text: "Check the work, sign on screen, then pay the balance.", icon: PenLine },
] as const;

export const REASONS = [
  { title: "Approved providers", text: "Every provider is reviewed by our team before they can take jobs.", icon: BadgeCheck },
  { title: "Payments through the system", text: "Your deposit is recorded in the system. Providers never collect your cash.", icon: ShieldCheck },
  { title: "Signed completion", text: "A job is finished only when you check the work and sign.", icon: PenLine },
] as const;

/** The four booking steps. Shared by the guest home page and the customer home page. */
export function HowItWorksSteps() {
  return (
    <ol className={styles.steps}>
      {STEPS.map((step, index) => (
        <li key={step.title} className={styles.step}>
          <span className={styles.badge} aria-hidden="true">{index + 1}</span>
          <step.icon className={styles.stepIcon} aria-hidden="true" />
          <h3 className={styles.stepTitle}>{step.title}</h3>
          <p className={styles.stepText}>{step.text}</p>
        </li>
      ))}
    </ol>
  );
}

/** The "why book with us" points. Shared by the guest home page and the customer home page. */
export function WhyBookList() {
  return (
    <ul className={styles.reasons}>
      {REASONS.map((reason) => (
        <li key={reason.title} className={styles.reason}>
          <reason.icon className={styles.reasonIcon} aria-hidden="true" />
          <h3 className={styles.reasonTitle}>{reason.title}</h3>
          <p>{reason.text}</p>
        </li>
      ))}
    </ul>
  );
}
