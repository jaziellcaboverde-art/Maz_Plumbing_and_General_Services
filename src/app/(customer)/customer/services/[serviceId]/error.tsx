"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import styles from "./page.module.css";

export default function ServiceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Could not load the service detail page", error);
  }, [error]);

  return <section className={styles.error} role="alert">
    <h1>Service details are unavailable</h1>
    <p>Please try again. If the issue continues, contact MAZ Support.</p>
    <Button variant="primary" type="button" onClick={reset}>Try again</Button>
  </section>;
}
