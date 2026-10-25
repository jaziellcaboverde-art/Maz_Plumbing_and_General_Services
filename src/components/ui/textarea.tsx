import { useId, type ComponentProps } from "react";
import { cx } from "@/lib/cx";
import { Field, type FieldStatus } from "./field";
import styles from "./textarea.module.css";

type TextareaProps = Omit<ComponentProps<"textarea">, "id"> & {
  label: string;
  hint?: string;
  message?: string;
  status?: FieldStatus;
};

/** A multi line text box with the same label, hint and message as Input. */
export function Textarea({ label, hint, message, status = "default", className, ...rest }: TextareaProps) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} message={message} status={status}>
      {({ describedBy, invalid }) => (
        <textarea
          {...rest}
          id={id}
          className={cx(styles.control, status === "success" && styles.success, className)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    </Field>
  );
}
