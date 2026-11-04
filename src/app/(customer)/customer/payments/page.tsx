import { Suspense } from "react";
import { CustomerPayments } from "@/components/workflow/customer-sections";
export default function Page() { return <Suspense fallback={<p role="status">Loading payments…</p>}><CustomerPayments /></Suspense>; }
