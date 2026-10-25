"use client";

import { useEffect, useRef } from "react";
import styles from "./auth-parts.module.css";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

let scriptPromise: Promise<TurnstileApi> | null = null;
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not start.")));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load the Cloudflare check."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** True when the Cloudflare check is switched on for this build (NEXT_PUBLIC_TURNSTILE_SITE_KEY is set). */
export const turnstileEnabled = SITE_KEY !== "";

/**
 * The Cloudflare Turnstile check. Calls onToken with a one time token when the visitor passes,
 * and with null when it expires, fails, or is reset. Change resetSignal to ask for a new check
 * (a token can be used once, so reset after every failed attempt).
 * Renders nothing when no site key is set.
 */
export function TurnstileWidget({ onToken, resetSignal = 0 }: { onToken: (token: string | null) => void; resetSignal?: number }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!SITE_KEY || !container.current) return;
    let cancelled = false;
    const element = container.current;
    loadTurnstile()
      .then((api) => {
        if (cancelled) return;
        widgetId.current = api.render(element, {
          sitekey: SITE_KEY,
          theme: "light",
          callback: (token) => callback.current(token),
          "expired-callback": () => callback.current(null),
          "error-callback": () => callback.current(null),
        });
      })
      .catch(() => callback.current(null));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetSignal === 0 || !widgetId.current || !window.turnstile) return;
    window.turnstile.reset(widgetId.current);
    callback.current(null);
  }, [resetSignal]);

  if (!SITE_KEY) return null;
  return <div ref={container} className={styles.turnstile} />;
}
