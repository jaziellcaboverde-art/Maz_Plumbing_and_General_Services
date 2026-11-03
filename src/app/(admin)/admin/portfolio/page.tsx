import { Suspense } from "react";
import { AdminPortfolio } from "@/components/workflow/admin-screens";
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading MAZ operations?</p>}>
      <AdminPortfolio />
    </Suspense>
  );
}
