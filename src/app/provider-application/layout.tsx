import { Suspense } from "react";

export default function ProviderApplicationLayout({ children }: LayoutProps<"/provider-application">) {
  return <Suspense fallback={<p role="status">Loading…</p>}>{children}</Suspense>;
}
