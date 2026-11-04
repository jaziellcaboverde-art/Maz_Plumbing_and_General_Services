import { Suspense } from "react";
import { AdminDashboard } from "@/components/workflow/admin-dashboard";
import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";
export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AdminDashboard />
    </Suspense>
  );
}
