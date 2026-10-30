"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { MouseEvent } from "react";
import styles from "./back-link.module.css";

/**
 * Goes back to the page the person came from. When there is nothing to go back to
 * (the page was opened in a new tab or by a direct link), it behaves as a normal link to fallbackHref.
 */
export function BackLink({ fallbackHref, label = "Back" }: { fallbackHref: string; label?: string }) {
  const router = useRouter();

  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    if (window.history.length > 1) {
      event.preventDefault();
      router.back();
    }
  }

  return (
    <Link className={styles.link} href={fallbackHref} onClick={goBack}>
      <ArrowLeft aria-hidden="true" />
      {label}
    </Link>
  );
}
