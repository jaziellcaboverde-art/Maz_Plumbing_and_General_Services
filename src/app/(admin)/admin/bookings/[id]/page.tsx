import { Suspense } from "react";
import { AdminBooking } from "@/components/workflow/admin-booking";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p role="status">Loading booking details…</p>}>
      <Detail params={params} />
    </Suspense>
  );
}
async function Detail({ params }: { params: Promise<{ id: string }> }) {
  return <AdminBooking id={(await params).id} />;
}
