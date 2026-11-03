import { Suspense } from "react";
import { AdminEvidence } from "@/components/workflow/admin-screens";
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading MAZ operations?</p>}>
      <AdminEvidence />
    </Suspense>
  );
}
