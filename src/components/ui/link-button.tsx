import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";
import styles from "./button.module.css";

export function LinkButton({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" }) {
  return (
    <Link
      {...props}
      className={cx(styles.button, styles[variant], className)}
    />
  );
}
