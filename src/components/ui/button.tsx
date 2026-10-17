import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";
import { Spinner } from "./spinner";
import { StatusMessage } from "./status-message";
import styles from "./button.module.css";

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary";
  /** Shows a spinner and blocks clicks. The label stays the same. */
  loading?: boolean;
  /** Shown next to a disabled button. Say what is missing. */
  disabledReason?: string;
};

export function Button({
  variant = "secondary",
  loading = false,
  disabled = false,
  disabledReason,
  type = "button",
  className,
  children,
  onClick,
  id,
  ...rest
}: ButtonProps) {
  const reasonId = disabled && disabledReason && id ? `${id}-reason` : undefined;
  const button = (
    <button
      {...rest}
      id={id}
      type={type}
      className={cx(styles.button, styles[variant], loading && styles.loading, className)}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      aria-describedby={reasonId ?? rest["aria-describedby"]}
      onClick={loading ? (event) => event.preventDefault() : onClick}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );

  if (!(disabled && disabledReason)) return button;
  return (
    <div className={styles.withReason}>
      {button}
      <StatusMessage status="info" id={reasonId}>
        {disabledReason}
      </StatusMessage>
    </div>
  );
}

/** Primary above secondary on phones. On wider screens the primary sits on the right. */
export function ButtonGroup({ children }: { children: React.ReactNode }) {
  return <div className={styles.group}>{children}</div>;
}
