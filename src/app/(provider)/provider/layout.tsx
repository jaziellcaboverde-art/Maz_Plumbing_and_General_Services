import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { providerSession } from "@/lib/provider/workspace";

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<p role="status">Loading…</p>}>
      <ProviderShell>{children}</ProviderShell>
    </Suspense>
  );
}

async function ProviderShell({ children }: { children: React.ReactNode }) {
  await providerSession();
  return (
    <AppShell role="provider" width="content">
      <ToastProvider>{children}</ToastProvider>
    </AppShell>
  );
}
