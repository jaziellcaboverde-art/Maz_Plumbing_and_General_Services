import { Suspense } from "react";
import { notFound } from "next/navigation";
import { findSection } from "@/components/layout/nav-config";
import { PlaceholderScreen } from "@/components/ui/placeholder-screen";

export default function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  return (
    <Suspense fallback={<p role="status">Loading…</p>}>
      <AdminSection params={params} />
    </Suspense>
  );
}

async function AdminSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const item = findSection("admin", section);
  if (!item) notFound();
  return <PlaceholderScreen title={item.label} phase={item.phase} />;
}
