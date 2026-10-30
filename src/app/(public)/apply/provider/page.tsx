import { AuthSplit } from "@/components/auth/auth-split";
import { loadApplyServices } from "@/lib/provider/load-apply-services";
import { ProviderApplyFlow } from "./apply-flow";

export default async function ProviderApplyPage() {
  const services = await loadApplyServices();
  return (
    <AuthSplit
      wide
      headline="Work with MAZ Plumbing."
      points={[
        "Fill in your details and upload your documents on one page",
        "Upload every required document: your ID, a selfie, an NBI clearance and proof of address. Only admins can view them",
        "We email you the result once an admin reviews your application",
      ]}
    >
      <ProviderApplyFlow services={services} />
    </AuthSplit>
  );
}
