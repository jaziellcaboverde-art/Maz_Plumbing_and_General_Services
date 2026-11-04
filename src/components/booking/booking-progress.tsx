import { Check } from "lucide-react";
import styles from "./booking-progress.module.css";

const STAGES = ["Pending", "Accepted", "Assigned", "Ongoing", "Completed"];

export function BookingProgress({ status }: { status: string }) {
  const current = STAGES.indexOf(status);
  return (
    <ol className={styles.progress} aria-label="Booking progress">
      {STAGES.map((stage, index) => (
        <li key={stage} className={styles.step} data-reached={index <= current}
          aria-current={index === current ? "step" : undefined}>
          <span className={styles.marker} aria-hidden="true">
            {index <= current ? <Check /> : <span className={styles.dot} />}
          </span>
          <span className={styles.label}>{stage}</span>
          <span className="sr-only">{index === current ? "Current stage" : index < current ? "Finished" : "Upcoming"}</span>
        </li>
      ))}
    </ol>
  );
}
