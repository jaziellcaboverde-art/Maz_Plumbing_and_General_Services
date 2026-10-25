import Link from "next/link";
import { Suspense } from "react";
import { BadgeCheck, CreditCard, PenLine, ShieldCheck, ClipboardList, Users } from "lucide-react";
import { BrandMark } from "@/components/public/brand-mark";
import { ServiceIcon } from "@/components/public/service-icon";
import { LAUNCH_SERVICES, type PublicService } from "@/lib/public/launch-services";
import { loadPublicServices } from "@/lib/public/load-services";
import { BUSINESS } from "@/lib/public/business-info";
import styles from "./page.module.css";

const STEPS = [
  { title: "Tell us what you need", text: "Choose a service, describe the job, add photos and pin your address.", icon: ClipboardList },
  { title: "Pick a provider", text: "See approved providers near you in a ranked list and choose one.", icon: Users },
  { title: "Pay the deposit", text: "Pay the deposit through the system to reserve your job.", icon: CreditCard },
  { title: "Sign when the job is done", text: "Check the work, sign on screen, then pay the balance.", icon: PenLine },
] as const;

const REASONS = [
  { title: "Approved providers", text: "Every provider is reviewed by our team before they can take jobs.", icon: BadgeCheck },
  { title: "Payments through the system", text: "Your deposit is recorded in the system. Providers never collect your cash.", icon: ShieldCheck },
  { title: "Signed completion", text: "A job is finished only when you check the work and sign.", icon: PenLine },
] as const;

export default function Home() {
  return (
    <div data-landing="true">
      <section className={styles.heroWrap} aria-labelledby="hero-title">
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{BUSINESS.shortTagline}</p>
            <h1 id="hero-title" className={styles.title}>Book trusted home services near you.</h1>
            <p className={styles.lead}>
              Request a job, choose an approved provider, pay your deposit through the system and track the work from start to signed completion. Now serving {BUSINESS.serviceArea}.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryAction} href="/signup">Create a customer account</Link>
              <Link className={styles.secondaryAction} href="/apply/provider">Apply to become a provider</Link>
            </div>
          </div>
          <div className={styles.heroMark} aria-hidden="true">
            <BrandMark priority />
          </div>
        </div>
      </section>

      <section id="how-it-works" className={styles.section} aria-labelledby="how-title">
        <h2 id="how-title" className={styles.heading}>How it works</h2>
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
      </section>

      <section id="services" className={styles.section} aria-labelledby="services-title">
        <h2 id="services-title" className={styles.heading}>Our services</h2>
        <p className={styles.sectionLead}>Plumbing, electrical and general home services, done by approved providers.</p>
        <Suspense fallback={<ServiceGrid services={LAUNCH_SERVICES} />}>
          <LiveServices />
        </Suspense>
      </section>

      <section className={styles.whyWrap} aria-labelledby="why-title">
        <div className={styles.why}>
          <h2 id="why-title" className={styles.heading}>Why book with us?</h2>
          <ul className={styles.reasons}>
            {REASONS.map((reason) => (
              <li key={reason.title} className={styles.reason}>
                <reason.icon className={styles.reasonIcon} aria-hidden="true" />
                <h3 className={styles.reasonTitle}>{reason.title}</h3>
                <p>{reason.text}</p>
              </li>
            ))}
          </ul>
          <p className={styles.whyNote}>
            Need help right away? Choose Emergency Service when you book. <Link href="/signup">Create your account</Link> to place your first request.
          </p>
        </div>
      </section>
    </div>
  );
}

async function LiveServices() {
  const services = await loadPublicServices();
  return <ServiceGrid services={services} />;
}

function ServiceGrid({ services }: { services: readonly PublicService[] }) {
  return (
    <ul className={styles.services}>
      {services.map((service) => (
        <li key={`${service.category}-${service.name}`} className={styles.service}>
          <span className={styles.serviceIcon}><ServiceIcon category={service.category} /></span>
          <p className={styles.serviceCategory}>{service.category}</p>
          <h3 className={styles.serviceName}>{service.name}</h3>
          {service.description && <p className={styles.serviceText}>{service.description}</p>}
        </li>
      ))}
    </ul>
  );
}
