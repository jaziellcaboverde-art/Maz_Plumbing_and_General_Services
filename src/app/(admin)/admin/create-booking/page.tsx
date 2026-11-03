import { Suspense } from "react";
import { AdminCreateBooking } from "@/components/workflow/admin-screens";
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading MAZ operations?</p>}>
      <AdminCreateBooking />
    </Suspense>
  );
}
