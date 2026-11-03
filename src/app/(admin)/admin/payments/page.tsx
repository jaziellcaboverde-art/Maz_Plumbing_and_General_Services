import { Suspense } from "react";
import { AdminPayments } from "@/components/workflow/admin-screens";
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading MAZ operations?</p>}>
      <AdminPayments />
    </Suspense>
  );
}
