import { Suspense } from "react";
import { CustomerReviews } from "@/components/workflow/customer-sections";
export default function Page() { return <Suspense fallback={<p role="status">Loading reviews…</p>}><CustomerReviews /></Suspense>; }
