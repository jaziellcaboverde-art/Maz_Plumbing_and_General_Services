import { Suspense } from "react";
import { CustomerBookings } from "@/components/workflow/customer-bookings";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    from?: string;
    to?: string;
  }>;
}) {
  return (
    <Suspense fallback={<p role="status">Loading bookings...</p>}>
      <Bookings searchParams={searchParams} />
    </Suspense>
  );
}
async function Bookings({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    from?: string;
    to?: string;
  }>;
}) {
  return <CustomerBookings filters={await searchParams} />;
}
