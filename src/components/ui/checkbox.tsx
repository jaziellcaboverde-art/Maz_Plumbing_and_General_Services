import { useId, type ComponentProps } from "react";
import { Check } from "lucide-react";
import { StatusMessage } from "./status-message";
import styles from "./checkbox.module.css";

type CheckboxProps = Omit<ComponentProps<"input">, "id" | "type" | "className"> & {
  label: string;
  /** Shown under the box. Setting it marks the box as an error. */
  error?: string;
};

export function Checkbox({ label, error, ...rest }: CheckboxProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={styles.root}>
      <label className={styles.item} htmlFor={id}>
        <span className={styles.control}>
          <input
            {...rest}
            id={id}
            type="checkbox"
            className={styles.input}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
          />
          <Check className={styles.check} aria-hidden="true" />
        </span>
        <span>{label}</span>
      </label>
      {error && (
        <StatusMessage status="error" id={errorId}>
          {error}
        </StatusMessage>
      )}
    </div>
  );
}
