import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailPreferenceEnabled } from "./preference-policy";

export { isEmailPreferenceEnabled } from "./preference-policy";

/** An absent preference keeps email enabled; in-app notifications are always enabled. */
export async function isEmailNotificationEnabled(profileId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_settings")
    .select("notification_prefs")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw new Error(`Could not load notification preferences: ${error.message}`);
  return isEmailPreferenceEnabled(data?.notification_prefs);
}
