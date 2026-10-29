import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p role="status">Loading your account…</p>}>
      <AppShell role="customer" width="content">
        {children}
      </AppShell>
    </Suspense>
  );
}
