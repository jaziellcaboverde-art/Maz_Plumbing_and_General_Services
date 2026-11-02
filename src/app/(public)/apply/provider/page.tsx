import { loadApplyServices } from "@/lib/provider/load-apply-services";
import { ProviderApplyFlow } from "./apply-flow";

export default async function ProviderApplyPage() {
  const services = await loadApplyServices();
  return <ProviderApplyFlow services={services} />;
}
