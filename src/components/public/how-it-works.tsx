import { BadgeCheck, ClipboardCheck, ClipboardList, FileCheck2, ShieldCheck, UserCheck } from "lucide-react";
import styles from "./how-it-works.module.css";

const STEPS = [
  { title: "Send your request", text: "Choose a service, preferred schedule and location, then describe the job.", icon: ClipboardList },
  { title: "MAZ reviews and assigns", text: "The owner checks the schedule and assigns an available provider with the required skill.", icon: UserCheck },
  { title: "Review the quotation", text: "After inspection, review the recorded scope and final quotation before work starts.", icon: FileCheck2 },
  { title: "Track the service", text: "Follow status updates, completion details and payment records in one place.", icon: ClipboardCheck },
] as const;

const REASONS = [
  { title: "Managed assignments", text: "Provider assignment stays under MAZ management and availability rules.", icon: BadgeCheck },
  { title: "Clear records", text: "Quotations and externally made payments can be documented and confirmed in the system.", icon: ShieldCheck },
  { title: "Easy tracking", text: "Customers, providers and the administrator see the information relevant to their role.", icon: ClipboardCheck },
] as const;

export function HowItWorks() {
  return <section className={styles.section} aria-labelledby="how-it-works-title">
    <h2 id="how-it-works-title">How KumpuNinja works</h2>
    <ol className={styles.steps}>{STEPS.map(({ title, text, icon: Icon }, index) => <li key={title}><Icon aria-hidden="true" /><strong>{index + 1}. {title}</strong><span>{text}</span></li>)}</ol>
    <ul className={styles.reasons}>{REASONS.map(({ title, text, icon: Icon }) => <li key={title}><Icon aria-hidden="true" /><strong>{title}</strong><span>{text}</span></li>)}</ul>
  </section>;
}
