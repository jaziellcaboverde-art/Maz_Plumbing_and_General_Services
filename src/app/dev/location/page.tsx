import { notFound } from "next/navigation";
import { LocationPicker } from "@/components/location/location-picker";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const metadata = { title: "Location preview" };

/** Local review page for Phase 4. It is never served in production. */
export default async function LocationPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let target: "address" | "provider" | undefined;
  let recordId: string | undefined;
  let role: string | undefined;

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    role = profile?.role;

    if (role === "customer") {
      const { data: address } = await supabase.from("addresses").select("id")
        .eq("profile_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (address) {
        target = "address";
        recordId = address.id;
      }
    } else if (role === "provider") {
      const { data: provider } = await supabase.from("provider_profiles").select("profile_id")
        .eq("profile_id", user.id).maybeSingle();
      if (provider) {
        target = "provider";
        recordId = provider.profile_id;
      }
    }
  }

  return (
    <main className={styles.page}>
      <h1>Location preview</h1>
      <p>
        {target
          ? `Signed in as ${role}. Saving updates your own ${target === "address" ? "address" : "provider profile"}.`
          : "Sign in as a customer with a saved address or a provider with a provider profile to test saving. As an admin or guest, you can preview the map and search, but saving is disabled."}
      </p>
      <LocationPicker target={target} recordId={recordId} />
    </main>
  );
}
