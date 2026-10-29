import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p role="status">Loading your account…</p>}>
      <AppShell role="admin" width="full">
        {children}
      </AppShell>
    </Suspense>
  );
}
