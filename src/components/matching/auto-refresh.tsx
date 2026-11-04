"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

/** Refreshes the page now and then while the customer waits for a provider to answer. */
export function AutoRefresh({ everySeconds = 30 }: { everySeconds?: number }) {
  const router = useRouter();
  const anchor = useRef<HTMLSpanElement>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (pending || document.visibilityState !== "visible" || anchor.current?.parentElement?.closest("[hidden]")) return;
      if (document.activeElement?.closest("form")) return;
      startTransition(() => router.refresh());
    }, everySeconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, everySeconds, pending]);
  return <span hidden aria-hidden="true" ref={anchor} />;
}
