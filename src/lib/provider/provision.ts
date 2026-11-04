import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { PreparedProvider, ProviderImportResult } from "./admin-import";

/** Only new auth users are touched. Compensate setup failures; never overwrite an existing account. */
export async function provisionProvider(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  row: PreparedProvider,
  source: "manual" | "csv",
): Promise<ProviderImportResult> {
  let providerId: string | undefined;
  try {
    const { data, error } = await admin.auth.admin.createUser({
      email: row.email,
      password: row.password,
      email_confirm: true,
      app_metadata: { role: "customer" },
      user_metadata: {
        first_name: row.firstName,
        last_name: row.lastName,
        mobile: row.mobile,
      },
    });
    if (error || !data.user)
      return {
        key: row.key,
        email: row.email,
        status: "failed",
        error:
          error?.code === "email_exists" ||
          error?.code === "email_already_exists" ||
          /already.*(registered|exists)/i.test(error?.message ?? "")
            ? "This email already has an account. The existing account was not changed."
            : "Could not create the sign-in account. Check the email and password requirements.",
      };
    providerId = data.user.id;
    const profile = await admin
      .from("profiles")
      .update({
        first_name: row.firstName,
        last_name: row.lastName,
        mobile: row.mobile,
      })
      .eq("id", providerId)
      .select("id")
      .single();
    if (profile.error || !profile.data) throw new Error("Profile setup failed");
    const now = new Date().toISOString();
    const provider = await admin
      .from("provider_profiles")
      .insert({
        profile_id: providerId,
        status: "approved",
        daily_rate: row.dailyRate,
        service_area: row.serviceArea || null,
        reviewed_by: actorId,
        reviewed_at: now,
      });
    if (provider.error) throw new Error("Provider setup failed");
    const claims = await admin
      .from("provider_service_claims")
      .insert(
        row.serviceIds.map((service_id) => ({
          provider_id: providerId,
          service_id,
          status: "approved",
          decided_by: actorId,
          decided_at: now,
          note: "Existing MAZ worker added and approved directly by administrator.",
        })),
      );
    if (claims.error) throw new Error("Service approval failed");
    const services = await admin
      .from("provider_services")
      .insert(
        row.serviceIds.map((service_id) => ({
          provider_id: providerId,
          service_id,
        })),
      );
    if (services.error) throw new Error("Service setup failed");
    // The database's profiles_sync_role trigger mirrors this role into auth app_metadata.
    const activation = await admin
      .from("profiles")
      .update({ role: "provider" })
      .eq("id", providerId)
      .select("id")
      .single();
    if (activation.error || !activation.data)
      throw new Error("Activation failed");
    const audit = await admin.rpc("write_audit", {
      p_actor: actorId,
      p_action: "provider.admin_created",
      p_target_table: "provider_profiles",
      p_target_id: providerId,
      p_reason: "Existing MAZ provider; application waived by administrator",
      p_details: { source, service_ids: row.serviceIds },
    });
    if (audit.error) throw new Error("Audit failed");
    return { key: row.key, email: row.email, status: "created", providerId };
  } catch {
    if (providerId) {
      try {
        const cleanup = await admin.auth.admin.deleteUser(providerId);
        if (cleanup.error)
          return {
            key: row.key,
            email: row.email,
            status: "uncertain",
            error:
              "Setup is incomplete and cleanup could not finish. Check this account in the directory before retrying.",
          };
      } catch {
        return {
          key: row.key,
          email: row.email,
          status: "uncertain",
          error:
            "Setup is incomplete. Check this account in the directory before retrying.",
        };
      }
    }
    if (!providerId)
      return {
        key: row.key,
        email: row.email,
        status: "uncertain",
        error:
          "The account creation response was interrupted. Check the directory before retrying.",
      };
    return {
      key: row.key,
      email: row.email,
      status: "failed",
      error:
        "Provider setup failed. The new account was rolled back; you may retry.",
    };
  }
}
