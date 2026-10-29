import { notFound } from "next/navigation";
import { NAV, findSection } from "@/components/layout/nav-config";
import { PlaceholderScreen } from "@/components/ui/placeholder-screen";

export function generateStaticParams() {
  return NAV.admin.items
    .filter((i) => i.slug && i.slug !== "settings" && i.slug !== "bookings" && i.slug !== "customers" && i.slug !== "chat" && i.slug !== "provider-applications" && i.slug !== "provider-schedules" && i.slug !== "calendar" && i.slug !== "config" && i.slug !== "services" && i.slug !== "users" && i.slug !== "audit-log")
    .map((i) => ({ section: i.slug }));
}

export default async function AdminSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const item = findSection("admin", section);
  if (!item) notFound();
  return <PlaceholderScreen title={item.label} phase={item.phase} />;
}
