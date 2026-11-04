import type { ReactNode } from "react";

export function creationIcon(label: ReactNode) {
  if (typeof label !== "string") return null;
  if (/^(create|add|new)\b/i.test(label.trim())) return "create";
  if (/^(book|request) (a |new |your )?service/i.test(label.trim()))
    return "service";
  return null;
}
