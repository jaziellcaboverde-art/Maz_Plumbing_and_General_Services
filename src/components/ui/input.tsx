import { useId, type ComponentProps } from "react";
import { cx } from "@/lib/cx";
import { Field, type FieldStatus } from "./field";
import styles from "./input.module.css";

type InputProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  hint?: string;
  /** Text under the field. Needed when status is error, success or loading. */
  message?: string;
  status?: FieldStatus;
};

export function Input({ label, hint, message, status = "default", className, ...rest }: InputProps) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} message={message} status={status}>
      {({ describedBy, invalid }) => (
        <input
          {...rest}
          id={id}
          className={cx(styles.control, status === "success" && styles.success, className)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-busy={status === "loading" || undefined}
        />
      )}
    </Field>
  );
}
