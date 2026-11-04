import { Suspense } from "react";
import { CustomerDashboard } from "@/components/workflow/customer-dashboard";
import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";
export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <CustomerDashboard />
    </Suspense>
  );
}
