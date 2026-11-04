import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<p role="status">Loading…</p>}>
      <AppShell role="admin" width="full">
        <ToastProvider>{children}</ToastProvider>
      </AppShell>
    </Suspense>
  );
}
