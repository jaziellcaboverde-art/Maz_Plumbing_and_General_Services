import { Suspense } from "react";
import { CustomerBooking } from "@/components/workflow/customer-booking";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p role="status">Loading booking...</p>}>
      <Booking params={params} />
    </Suspense>
  );
}
async function Booking({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerBooking id={id} />;
}
