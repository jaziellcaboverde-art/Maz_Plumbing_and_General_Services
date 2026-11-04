import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";

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
        {children}
        {modal}
      </AppShell>
    </Suspense>
  );
}
