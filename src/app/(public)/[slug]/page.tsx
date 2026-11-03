import { Suspense } from "react";
import { PublicPlaceholderContent } from "./content";

export function generateStaticParams() {
  return ["terms", "privacy", "cancellation"].map(slug => ({ slug }));
}

export default function PublicPlaceholder({ params }: { params: Promise<{ slug: string }> }) {
  return <Suspense fallback={<p role="status">Loading this page…</p>}><PublicPlaceholderContent params={params} /></Suspense>;
}
