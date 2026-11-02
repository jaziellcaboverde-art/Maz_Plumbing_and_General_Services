"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./auth-parts.module.css";

type Api = { ready: (fn: () => void) => void; render: (el: HTMLElement, options: { sitekey: string; theme: "light"; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => number; reset: (id?: number) => void };
declare global { interface Window { grecaptcha?: Api } }
const KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ?? "";
const URL = "https://www.google.com/recaptcha/api.js?render=explicit";
export const recaptchaEnabled = Boolean(KEY);

function load(): Promise<Api> {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha) { window.grecaptcha.ready(() => resolve(window.grecaptcha!)); return; }
    let script = document.querySelector<HTMLScriptElement>('script[data-maz-recaptcha]');
    const timeout = window.setTimeout(() => reject(new Error("Verification timed out. Check your connection or browser extensions.")), 15000);
    const success = () => { if (!window.grecaptcha) return; clearTimeout(timeout); window.grecaptcha.ready(() => resolve(window.grecaptcha!)); };
    const failure = () => { clearTimeout(timeout); reject(new Error("Google reCAPTCHA could not load. Check network access or ad blockers.")); };
    if (!script) { script = document.createElement("script"); script.src = URL; script.async = true; script.defer = true; script.dataset.mazRecaptcha = "true"; }
    script.addEventListener("load", success, { once: true });
    script.addEventListener("error", failure, { once: true });
    if (!script.isConnected) document.head.appendChild(script);
    // If another mounted widget already loaded the script, use its API.
    if (window.grecaptcha) success();
  });
}

export function RecaptchaWidget({ onToken, resetSignal = 0 }: { onToken: (token: string | null) => void; resetSignal?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef<number | null>(null);
  const callback = useRef(onToken);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { callback.current = onToken; }, [onToken]);
  useEffect(() => {
    if (!KEY || !ref.current) return;
    let active = true;
    load().then(api => {
      if (!active || !ref.current || id.current !== null) return;
      id.current = api.render(ref.current, { sitekey: KEY, theme: "light", callback: token => { setError(null); callback.current(token); }, "expired-callback": () => callback.current(null), "error-callback": () => { setError("Verification failed to load. Refresh the page and try again."); callback.current(null); } });
    }).catch(err => { if (active) { setError(err instanceof Error ? err.message : "Verification unavailable."); callback.current(null); } });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (resetSignal && id.current !== null && window.grecaptcha) { window.grecaptcha.reset(id.current); callback.current(null); } }, [resetSignal]);
  if (!KEY) return null;
  return <div className={styles.verificationBox}><div ref={ref} aria-label="Google reCAPTCHA verification" />{error && <p role="alert" className={styles.verificationError}>{error}</p>}</div>;
}
