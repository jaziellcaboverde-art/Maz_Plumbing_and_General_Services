import Link from "next/link";
import { ArrowUpRight, CalendarPlus, CirclePlus } from "lucide-react";
import type { ComponentProps } from "react";
import styles from "./action-link.module.css";
import { creationIcon } from "./action-icon";

/** A navigation action with the same target and keyboard behavior as a normal link. */
export function ActionLink({
  children,
  className,
  ...props
}: ComponentProps<typeof Link>) {
  const kind = creationIcon(children);
  const Icon =
    kind === "service"
      ? CalendarPlus
      : kind === "create"
        ? CirclePlus
        : ArrowUpRight;
  return (
    <Link
      {...props}
      className={[styles.link, className].filter(Boolean).join(" ")}
    >
      <span>{children}</span>
      <Icon aria-hidden="true" className={styles.icon} />
    </Link>
  );
}
