import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ComponentProps } from "react";
import styles from "./action-link.module.css";

/** A navigation action with the same target and keyboard behavior as a normal link. */
export function ActionLink({
  children,
  className,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={[styles.link, className].filter(Boolean).join(" ")}
    >
      <span>{children}</span>
      <ArrowUpRight aria-hidden="true" className={styles.icon} />
    </Link>
  );
}
