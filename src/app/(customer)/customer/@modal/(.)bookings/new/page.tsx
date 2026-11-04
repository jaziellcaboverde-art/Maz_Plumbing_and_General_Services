import NewBooking from "../../../bookings/new/page";
import { RouteModal } from "@/components/ui/route-modal";
import type { ServiceRequest } from "@/lib/booking/service-selection";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<ServiceRequest & { draft?: string }>;
}) {
  return (
    <RouteModal title="Request a service">
      <NewBooking searchParams={searchParams} />
    </RouteModal>
  );
}
