"use client";

import Form from "next/form";
import { useEffect, useRef, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

/** Search waits for typing to pause; choices apply immediately without adding history entries. */
export function AutoFilterForm({
  action,
  children,
  className,
  label,
}: {
  action: string;
  children: ReactNode;
  className?: string;
  label: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitted = useRef<string | null>(null);
  const params = useSearchParams();
  const query = params.toString();
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    const current = new URLSearchParams(query);
    const sent =
      submitted.current === null
        ? null
        : new URLSearchParams(submitted.current);
    if (sent && [...sent].every(([key, value]) => current.get(key) === value))
      return;
    // External navigation (Clear, Back, Forward) restores the fields from the URL.
    if (timer.current) clearTimeout(timer.current);
    const element = form.current;
    if (!element) return;
    for (const field of element.elements) {
      if (
        (field instanceof HTMLInputElement ||
          field instanceof HTMLSelectElement) &&
        field.name
      )
        field.value = current.get(field.name) ?? "";
    }
    submitted.current = null;
  }, [query]);
  return (
    <Form
      ref={form}
      action={action}
      replace
      scroll={false}
      className={className}
      aria-label={label}
      onClickCapture={(event) => {
        const link =
          event.target instanceof Element ? event.target.closest("a") : null;
        if (!link) return;
        const destination = new URL(link.href);
        if (destination.pathname !== action) return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        submitted.current = null;
        for (const field of event.currentTarget.elements) {
          if (
            (field instanceof HTMLInputElement ||
              field instanceof HTMLSelectElement) &&
            field.name
          )
            field.value = destination.searchParams.get(field.name) ?? "";
        }
      }}
      onChange={(event) => {
        if (timer.current) clearTimeout(timer.current);
        const field = event.target;
        const element = event.currentTarget;
        const submit = () => {
          timer.current = null;
          if (element.checkValidity()) element.requestSubmit();
        };
        if (
          field instanceof HTMLInputElement &&
          ["search", "text"].includes(field.type)
        ) {
          timer.current = setTimeout(submit, 400);
        } else submit();
      }}
      onSubmit={(event) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        const values = new URLSearchParams();
        new FormData(event.currentTarget).forEach((value, key) => {
          if (typeof value === "string") values.append(key, value);
        });
        submitted.current = values.toString();
      }}
    >
      {children}
    </Form>
  );
}
