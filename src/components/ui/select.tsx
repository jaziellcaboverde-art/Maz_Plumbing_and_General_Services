import { useId, type ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "@/lib/cx";
import { Field, type FieldStatus } from "./field";
import styles from "./select.module.css";

type SelectProps = Omit<ComponentProps<"select">, "id"> & {
  label: string;
  hint?: string;
  message?: string;
  status?: FieldStatus;
};

/** Uses the browser's own select, so phones show their native picker. */
export function Select({ label, hint, message, status = "default", className, children, ...rest }: SelectProps) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} message={message} status={status}>
      {({ describedBy, invalid }) => (
        <div className={styles.wrap}>
          <select
            {...rest}
            id={id}
            className={cx(styles.control, status === "success" && styles.success, className)}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
          >
            {children}
          </select>
          <ChevronDown className={styles.chevron} aria-hidden="true" />
        </div>
      )}
    </Field>
  );
}
