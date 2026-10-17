import { Check, CircleAlert } from "lucide-react";
import { cx } from "@/lib/cx";
import styles from "./stepper.module.css";

export type Step = {
  id: string;
  label: string;
  /** Marks a step that needs fixing, for example a form with a missing field. */
  error?: boolean;
};

type StepperProps = {
  steps: Step[];
  /** Zero based index of the step the person is on. */
  current: number;
  /** Read by screen readers: "Booking progress". */
  label: string;
};

/** Only for a real sequence: sign up, booking, quote, signature. The numbers carry meaning. */
export function Stepper({ steps, current, label }: StepperProps) {
  return (
    <nav aria-label={label}>
      <ol className={styles.list}>
        {steps.map((step, index) => {
          const state = step.error ? "error" : index < current ? "complete" : index === current ? "current" : "upcoming";
          const word = { error: "Needs attention", complete: "Completed", current: "Current step", upcoming: "Not started" }[state];
          return (
            <li
              key={step.id}
              className={cx(styles.step, styles[state])}
              aria-current={index === current ? "step" : undefined}
            >
              <span className={styles.marker}>
                {state === "complete" ? (
                  <Check className={styles.icon} aria-hidden="true" />
                ) : state === "error" ? (
                  <CircleAlert className={styles.icon} aria-hidden="true" />
                ) : (
                  <span aria-hidden="true">{index + 1}</span>
                )}
              </span>
              <span className={cx(styles.label, index === current && styles.labelCurrent)}>
                <span className="sr-only">
                  Step {index + 1} of {steps.length}, {word}:{" "}
                </span>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
