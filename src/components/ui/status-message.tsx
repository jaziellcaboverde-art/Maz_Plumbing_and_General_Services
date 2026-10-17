import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cx } from "@/lib/cx";
import styles from "./status-message.module.css";

export type Status = "success" | "warning" | "error" | "info";

const ICONS = {
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
  info: Info,
} as const;

const WORDS: Record<Status, string> = {
  success: "Success",
  warning: "Warning",
  error: "Error",
  info: "Note",
};

/** A message with a Lucide icon and text. Status is never shown by color alone. */
export function StatusMessage({
  status,
  id,
  children,
}: {
  status: Status;
  id?: string;
  children: ReactNode;
}) {
  const Icon = ICONS[status];
  return (
    <p
      id={id}
      className={cx(styles.message, styles[status])}
      role={status === "error" ? "alert" : "status"}
    >
      <Icon className={styles.icon} aria-hidden="true" />
      <span>
        <span className="sr-only">{WORDS[status]}: </span>
        {children}
      </span>
    </p>
  );
}
