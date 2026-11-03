import { SettingsScreen } from "@/components/ui/settings-screen";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProviderPayoutForm } from "./provider-payout-form";

export default async function ProviderSettings() {
  await connection();
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminClient();
  const [{ data: profile }, { data: provider }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    admin.from("provider_profiles").select("status,payout_method,payout_account_name,payout_account_number").eq("profile_id", user.id).maybeSingle(),
  ]);
  if (profile?.role !== "provider") redirect("/customer");

  return <SettingsScreen>
    <section>
      <h2>Payout details</h2>
      {provider?.status === "approved" ? <>
        <p>Add your payout account before your first payout. Visible only to you and authorized MAZ admins.</p>
        <ProviderPayoutForm
          initialMethod={provider.payout_method ?? ""}
          initialAccountName={provider.payout_account_name ?? ""}
          initialAccountNumber={provider.payout_account_number ?? ""}
        />
      </> : <p>Payout details can be added after your provider application is approved.</p>}
    </section>
  </SettingsScreen>;
}
