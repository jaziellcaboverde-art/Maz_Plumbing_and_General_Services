import { Suspense } from "react";
import { CustomerProjects } from "@/components/workflow/customer-sections";
export default function Page() { return <Suspense fallback={<p role="status">Loading projects…</p>}><CustomerProjects /></Suspense>; }
