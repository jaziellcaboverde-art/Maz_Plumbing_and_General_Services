"use client";

import { RecaptchaWidget, recaptchaEnabled } from "./recaptcha-widget";
import { TurnstileWidget, turnstileEnabled } from "./turnstile-widget";

export const humanVerificationEnabled = recaptchaEnabled || turnstileEnabled;

export function HumanVerificationWidget({
  onToken,
  resetSignal = 0,
}: {
  onToken: (token: string | null) => void;
  resetSignal?: number;
}) {
  if (recaptchaEnabled) {
    return <RecaptchaWidget onToken={onToken} resetSignal={resetSignal} />;
  }
  if (turnstileEnabled) {
    return <TurnstileWidget onToken={onToken} resetSignal={resetSignal} />;
  }
  return null;
}
