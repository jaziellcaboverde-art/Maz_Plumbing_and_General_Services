import NewBooking from "../../../bookings/new/page";
import { RouteModal } from "@/components/ui/route-modal";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; service?: string }>;
}) {
  return (
    <RouteModal title="Request a service">
      <NewBooking searchParams={searchParams} />
    </RouteModal>
  );
}
