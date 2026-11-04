import Link from "next/link";
import { Suspense } from "react";
import {
  BadgeCheck,
  CreditCard,
  PenLine,
  ShieldCheck,
  ClipboardList,
  Users,
  Droplets,
  Zap,
  Wrench,
} from "lucide-react";
import { BrandMark } from "@/components/public/brand-mark";
import { HeroLineArt } from "@/components/public/hero-line-art";
import { LiveServices } from "@/components/public/service-grid";
import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";
import { BUSINESS } from "@/lib/public/business-info";
import styles from "./page.module.css";

const STEPS = [
  {
    title: "Tell us what you need",
    text: "Choose a service, describe the job, add photos and pin your address.",
    icon: ClipboardList,
  },
  {
    title: "MAZ confirms your team",
    text: "MAZ reviews your request and assigns qualified workers.",
    icon: Users,
  },
  {
    title: "Approve scope and payment",
    text: "Review the quotation and pay the amount required for your project.",
    icon: CreditCard,
  },
  {
    title: "Sign when the job is done",
    text: "Check the work, sign on screen, then pay the balance.",
    icon: PenLine,
  },
] as const;

const REASONS = [
  {
    title: "Approved providers",
    text: "Every provider is reviewed by our team before they can take jobs.",
    icon: BadgeCheck,
  },
  {
    title: "Payments through the system",
    text: "Your deposit is recorded in the system. Providers never collect your cash.",
    icon: ShieldCheck,
  },
  {
    title: "Verified completion",
    text: "MAZ checks the work, then you acknowledge turnover.",
    icon: PenLine,
  },
] as const;

export default function Home() {
  return (
    <div data-landing="true">
      <section className={styles.heroWrap} aria-labelledby="hero-title">
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <h1 id="hero-title" className={styles.title}>
              Book trusted home services near you.
            </h1>
            <p className={styles.lead}>
              Request a service, approve the MAZ quotation and track your
              assigned team through completion. Now serving{" "}
              {BUSINESS.serviceArea}.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryAction} href="/signup">
                Create a customer account
              </Link>
              <Link className={styles.secondaryAction} href="/apply/provider">
                Apply to become a provider
              </Link>
            </div>
            <ul className={styles.heroAssurances} aria-label="Our promises">
              <li>
                <BadgeCheck aria-hidden="true" /> Approved providers
              </li>
              <li>
                <ShieldCheck aria-hidden="true" /> Payments through the system
              </li>
              <li>
                <PenLine aria-hidden="true" /> Signed completion
              </li>
            </ul>
          </div>
          <div className={styles.heroGraphic} aria-hidden="true">
            <HeroLineArt />
            <div className={styles.heroMark}>
              <BrandMark priority />
            </div>
            <span className={`${styles.heroChip} ${styles.chipPlumbing}`}>
              <Droplets /> Plumbing
            </span>
            <span className={`${styles.heroChip} ${styles.chipElectrical}`}>
              <Zap /> Electrical
            </span>
            <span className={`${styles.heroChip} ${styles.chipGeneral}`}>
              <Wrench /> General services
            </span>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className={styles.section}
        aria-labelledby="how-title"
      >
        <h2 id="how-title" className={styles.heading}>
          How it works
        </h2>
        <p className={styles.sectionLead}>
          From request to signed completion in four clear steps.
        </p>
        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepCircle} aria-hidden="true">
                <step.icon className={styles.stepIcon} />
                <span className={styles.badge}>{index + 1}</span>
              </span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepText}>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="services"
        className={styles.section}
        aria-labelledby="services-title"
      >
        <h2 id="services-title" className={styles.heading}>
          Our services
        </h2>
        <p className={styles.sectionLead}>
          Choose a service to see our portfolio and customer reviews.
        </p>
        <Suspense fallback={<DashboardSkeleton />}>
          <LiveServices />
        </Suspense>
      </section>

      <section className={styles.whyWrap} aria-labelledby="why-title">
        <div className={styles.why}>
          <h2 id="why-title" className={styles.whyHeading}>
            Why book with us?
          </h2>
          <ul className={styles.reasons}>
            {REASONS.map((reason) => (
              <li key={reason.title} className={styles.reason}>
                <reason.icon className={styles.reasonIcon} aria-hidden="true" />
                <h3 className={styles.reasonTitle}>{reason.title}</h3>
                <p>{reason.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
