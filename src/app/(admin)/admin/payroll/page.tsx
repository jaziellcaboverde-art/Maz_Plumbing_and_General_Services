import { Suspense } from "react";
import { AdminPayroll } from "@/components/workflow/admin-screens";

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading provider payroll...</p>}>
      <AdminPayroll />
    </Suspense>
  );
}
