"use client";

import { useId, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cx } from "@/lib/cx";
import { Field, type FieldStatus } from "./field";
import styles from "./input.module.css";

type InputProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  hint?: string;
  /** Text under the field. Needed when status is error, success or loading. */
  message?: string;
  status?: FieldStatus;
  /** Fixed text before the typed value, such as "+63". Shown inside the box with a divider. */
  prefix?: string;
};

export function Input({ label, hint, message, status = "default", className, type = "text", prefix, ...rest }: InputProps) {
  const id = useId();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <Field id={id} label={label} hint={hint} message={message} status={status}>
      {({ describedBy, invalid }) => (
        <>
          <div className={isPassword ? styles.passwordWrap : prefix ? cx(styles.prefixWrap, rest.disabled && styles.prefixDisabled) : undefined}
            data-invalid={prefix && invalid ? "true" : undefined} data-success={prefix && status === "success" ? "true" : undefined}>
            {prefix && <span className={styles.prefix} aria-hidden="true">{prefix}</span>}
            <input
              {...rest}
              id={id}
              type={isPassword && passwordVisible ? "text" : type}
              className={cx(styles.control, prefix && styles.prefixControl, status === "success" && !prefix && styles.success, className)}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              aria-busy={status === "loading" || undefined}
            />
            {isPassword && (
              <button
                className={styles.passwordToggle}
                type="button"
                aria-label={passwordVisible ? "Hide password" : "Show password"}
                aria-pressed={passwordVisible}
                aria-controls={id}
                disabled={rest.disabled}
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                {passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            )}
          </div>
        </>
      )}
    </Field>
  );
}
