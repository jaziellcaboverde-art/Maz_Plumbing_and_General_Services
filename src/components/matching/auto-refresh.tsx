"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refreshes the page now and then while the customer waits for a provider to answer. */
export function AutoRefresh({ everySeconds = 20 }: { everySeconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everySeconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, everySeconds]);
  return null;
}
