import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProviderApplicationForm } from "./provider-application-form";

export async function ProviderApplicationSubmitContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/provider-application/submit");
  const admin = createAdminClient();
  const [{ data: profile }, { data: services }, { data: existing }] = await Promise.all([
    admin.from("profiles").select("role,first_name,last_name,mobile,birthday").eq("id", user.id).maybeSingle(),
    admin.from("services").select("id,category,name").eq("active", true).order("sort_order"),
    admin.from("provider_profiles").select("status").eq("profile_id", user.id).maybeSingle(),
  ]);
  if (profile?.role === "provider") redirect("/provider");
  if (existing) redirect("/provider-application");
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const account = {
    firstName: profile?.first_name ?? meta.first_name ?? meta.given_name ?? "",
    lastName: profile?.last_name ?? meta.last_name ?? meta.family_name ?? "",
    birthday: profile?.birthday ?? meta.birthday ?? "",
    mobile: profile?.mobile ?? meta.mobile ?? "",
  };
  // Show the account fields only when something is missing, such as after Google sign up.
  const needsAccountDetails = !account.firstName || !account.lastName || !account.birthday || !/^\+639\d{9}$/.test(account.mobile);
  return <ProviderApplicationForm services={services ?? []} account={needsAccountDetails ? account : null} />;
}




export default ProviderApplicationSubmitContent;
