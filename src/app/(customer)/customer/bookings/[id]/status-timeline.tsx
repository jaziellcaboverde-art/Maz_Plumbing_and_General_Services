import { TIMELINE_STEPS, timelineIndex, type OfficialStatus } from "@/lib/booking/official-status";
import styles from "./page.module.css";

/** Pending, Accepted, Assigned, Ongoing, Completed (spec 6.2). A cancelled booking shows one line instead. */
export function StatusTimeline({ status }: { status: OfficialStatus | null }) {
  if (status === "Cancelled") return <p className={styles.timelineCancelled}>This booking was cancelled.</p>;
  const current = timelineIndex(status);
  return (
    <ol className={styles.timeline} aria-label="Booking progress">
      {TIMELINE_STEPS.map((step, index) => (
        <li key={step} className={styles.timelineStep} data-state={index < current ? "done" : index === current ? "current" : "next"} aria-current={index === current ? "step" : undefined}>
          <span className={styles.timelineDot} aria-hidden="true" />
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
