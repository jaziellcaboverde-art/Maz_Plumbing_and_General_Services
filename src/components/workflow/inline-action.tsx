"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import styles from "./approval.module.css";
export function InlineAction({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.inlineAction}>
      <Button aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide form" : label}
      </Button>
      {open && <div className={styles.formBody}>{children}</div>}
    </div>
  );
}
