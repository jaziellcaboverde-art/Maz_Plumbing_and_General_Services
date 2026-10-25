"use client";

import { useState, type ComponentProps } from "react";
import { localDigits, PH_DIAL_CODE, PH_LOCAL_LENGTH, toE164 } from "@/lib/phone";
import { Input } from "./input";

type PhoneInputProps = Omit<ComponentProps<typeof Input>, "prefix" | "type" | "value" | "defaultValue" | "onChange" | "name"> & {
  /** Form field name. A hidden field with this name carries the full +639XXXXXXXXX number. */
  name?: string;
  /** Full or partial number to start with, for example "+639171234567". */
  defaultValue?: string;
  /** Controlled use: the full number, and a callback with the new full number. */
  value?: string;
  onValueChange?: (full: string) => void;
};

/**
 * Mobile number box with a fixed "+63" before it. People type the 10 digits that start with 9.
 * The form still reads one value, the full +639XXXXXXXXX number, so no server rule changes.
 */
export function PhoneInput({ name, defaultValue = "", value, onValueChange, ...rest }: PhoneInputProps) {
  const [inner, setInner] = useState(() => localDigits(defaultValue));
  const digits = value !== undefined ? localDigits(value) : inner;

  function change(raw: string) {
    const next = localDigits(raw);
    setInner(next);
    onValueChange?.(toE164(next));
  }

  return (
    <>
      <Input
        {...rest}
        prefix={PH_DIAL_CODE}
        type="tel"
        inputMode="numeric"
        autoComplete={rest.autoComplete ?? "tel-national"}
        maxLength={PH_LOCAL_LENGTH + 2}
        pattern="9[0-9]{9}"
        title="Enter 10 digits. A mobile number starts with 9."
        value={digits}
        onChange={(event) => change(event.target.value)}
      />
      {name && <input type="hidden" name={name} value={toE164(digits)} />}
    </>
  );
}
