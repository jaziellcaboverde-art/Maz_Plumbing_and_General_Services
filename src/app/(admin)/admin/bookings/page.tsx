import { Suspense } from "react";
import { AdminBookings } from "@/components/workflow/admin-bookings";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    page?: string;
    from?: string;
    to?: string;
  }>;
}) {
  return (
    <Suspense fallback={<p role="status">Loading bookings…</p>}>
      <List searchParams={searchParams} />
    </Suspense>
  );
}
async function List({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    page?: string;
    from?: string;
    to?: string;
  }>;
}) {
  return <AdminBookings filters={await searchParams} />;
}
