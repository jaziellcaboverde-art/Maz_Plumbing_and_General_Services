import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverNotifications } from "@/lib/matching/engine";

export async function notifyProviderSubmission(
  bookingId: string,
  title: string,
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin");
  if (error) {
    console.error("Could not load MAZ recipients", error);
    return;
  }
  await deliverNotifications(
    (data ?? []).map((profile) => ({
      profile_id: profile.id,
      event: "provider.work_update",
      title,
      body: `Review the provider activity for booking ${bookingId}.`,
      link: "/admin/provider-work-updates",
      channels: ["in_app"],
    })),
  );
}
