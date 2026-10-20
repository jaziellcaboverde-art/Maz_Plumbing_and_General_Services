import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProviderApplicationForm } from "./provider-application-form";

export default async function ProviderApplicationSubmitPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/provider-application/submit");
  const admin = createAdminClient();
  const [{ data: profile }, { data: services }, { data: existing }, { data: nbiPolicy }] = await Promise.all([
    admin.from("profiles").select("role,first_name,last_name,mobile,birthday").eq("id", user.id).maybeSingle(),
    admin.from("services").select("id,category,name").eq("active", true).order("sort_order"),
    admin.from("provider_profiles").select("status").eq("profile_id", user.id).maybeSingle(),
    admin.from("config").select("value").eq("key", "provider.nbi_clearance_required").maybeSingle(),
  ]);
  if (profile?.role === "provider") redirect("/provider");
  if (existing) redirect("/provider-application");
  return <ProviderApplicationForm services={services ?? []} nbiClearanceRequired={nbiPolicy?.value === true} />;
}
