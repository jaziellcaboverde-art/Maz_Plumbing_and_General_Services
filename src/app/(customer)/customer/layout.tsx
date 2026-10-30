import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="customer" width="content">
      <ToastProvider>{children}</ToastProvider>
    </AppShell>
  );
}
