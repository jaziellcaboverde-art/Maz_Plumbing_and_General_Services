import Detail from "../../../bookings/[id]/page";
import { RouteModal } from "@/components/ui/route-modal";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RouteModal title="Booking details">
      <Detail params={params} />
    </RouteModal>
  );
}
