import { Suspense } from "react";
import { PublicShell } from "@/components/layout/public-shell";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell><Suspense fallback={<p role="status">Loading…</p>}>{children}</Suspense></PublicShell>;
}
