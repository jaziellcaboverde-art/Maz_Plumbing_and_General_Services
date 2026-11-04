import History from "../../../bookings/history/page";
import { RouteModal } from "@/components/ui/route-modal";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  return (
    <RouteModal title="Service history">
      <History searchParams={searchParams} />
    </RouteModal>
  );
}
