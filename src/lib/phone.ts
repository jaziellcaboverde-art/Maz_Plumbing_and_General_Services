/** Philippine mobile numbers. The database keeps the full +639XXXXXXXXX form; screens show only the last 10 digits. */
export const PH_DIAL_CODE = "+63";
export const PH_LOCAL_LENGTH = 10;

/** Keep digits only, drop a pasted +63, 63 or leading 0, and stop at 10 digits. */
export function localDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length > PH_LOCAL_LENGTH) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, PH_LOCAL_LENGTH);
}

/** "9171234567" becomes "+639171234567". An empty box stays empty so "required" can catch it. */
export function toE164(digits: string): string {
  return digits ? `${PH_DIAL_CODE}${digits}` : "";
}

export function isPhMobile(value: string): boolean {
  return /^\+639\d{9}$/.test(value);
}

export const PHONE_ERROR = "Enter your 10-digit mobile number. It starts with 9.";
