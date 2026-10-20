import { notFound } from "next/navigation";
import { PlaceholderScreen } from "@/components/ui/placeholder-screen";
import { createClient } from "@/lib/supabase/server";

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
  if (slug === "terms" || slug === "privacy") {
    const supabase = await createClient();
    const { data: version } = await supabase.from("legal_versions")
      .select("version, body")
      .eq("doc_type", slug)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (version) {
      return (
        <article>
          <h1>{page.title}</h1>
          <p>Version {version.version}</p>
          {version.body.split("\n").filter(Boolean).map((paragraph: string, index: number) => <p key={index}>{paragraph}</p>)}
        </article>
      );
    }
  }
  return <PlaceholderScreen title={page.title} phase={page.phase} />;
}
