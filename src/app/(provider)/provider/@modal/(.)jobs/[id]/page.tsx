import Detail from "../../../jobs/[id]/page";
import { RouteModal } from "@/components/ui/route-modal";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RouteModal title="Assignment details">
      <Detail params={params} />
    </RouteModal>
  );
}
