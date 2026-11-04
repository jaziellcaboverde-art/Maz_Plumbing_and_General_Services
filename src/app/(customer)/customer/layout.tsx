import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";

export default function CustomerLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <Suspense fallback={<p role="status">Loading…</p>}>
      <AppShell role="customer" width="content">
        <ToastProvider>
          {children}
          {modal}
        </ToastProvider>
      </AppShell>
    </Suspense>
  );
}
