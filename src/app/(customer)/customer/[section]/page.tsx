import { notFound } from "next/navigation";
import { NAV, findSection } from "@/components/layout/nav-config";
import { PlaceholderScreen } from "@/components/ui/placeholder-screen";

export function generateStaticParams() {
  return NAV.customer.items
    .filter((i) => i.slug && i.slug !== "settings")
    .map((i) => ({ section: i.slug }));
}

export default async function CustomerSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const item = findSection("customer", section);
  if (!item) notFound();
  return <PlaceholderScreen title={item.label} phase={item.phase} />;
}
