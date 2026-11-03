import { Suspense } from "react";
import { CustomerDashboard } from "@/components/workflow/customer-dashboard";
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading your dashboard...</p>}>
      <CustomerDashboard />
    </Suspense>
  );
}
