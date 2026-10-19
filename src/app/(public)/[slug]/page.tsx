import { notFound } from "next/navigation";
import { PlaceholderScreen } from "@/components/ui/placeholder-screen";

const PAGES: Record<string, { title: string; phase: number }> = {
  terms: { title: "Terms", phase: 16 },
  privacy: { title: "Privacy", phase: 16 },
  cancellation: { title: "Cancellation", phase: 16 },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export default async function PublicPlaceholder({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();
  return <PlaceholderScreen title={page.title} phase={page.phase} />;
}
