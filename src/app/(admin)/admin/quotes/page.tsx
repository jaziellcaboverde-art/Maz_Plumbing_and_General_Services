import { Suspense } from "react";
import { AdminQuotes } from "@/components/workflow/admin-screens";
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading quotations and agreements…</p>}>
      <AdminQuotes />
    </Suspense>
  );
}
