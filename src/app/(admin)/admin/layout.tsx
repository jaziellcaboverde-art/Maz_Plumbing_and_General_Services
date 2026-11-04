import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";

export default function AdminLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <Suspense fallback={<p role="status">Loading…</p>}>
      <AppShell role="admin" width="full">
        {children}
        {modal}
      </AppShell>
    </Suspense>
  );
}
