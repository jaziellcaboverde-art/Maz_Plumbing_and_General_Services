import { Suspense } from "react";
import { CustomerBookings } from "@/components/workflow/customer-bookings";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  return (
    <Suspense fallback={<p role="status">Loading history...</p>}>
      <History searchParams={searchParams} />
    </Suspense>
  );
}
async function History({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  return <CustomerBookings filters={await searchParams} history />;
}
