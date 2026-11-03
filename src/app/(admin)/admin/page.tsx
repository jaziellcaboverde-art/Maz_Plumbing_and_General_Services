import { Suspense } from "react";
import { AdminDashboard } from "@/components/workflow/admin-dashboard";
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading MAZ operations?</p>}>
      <AdminDashboard />
    </Suspense>
  );
}
