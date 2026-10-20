import type { ReactNode } from "react";
import { AppearanceSettings } from "./appearance-settings";
import { PasswordSettingsForm } from "./password-settings-form";
import styles from "./settings-screen.module.css";
import { PageHeading } from "@/components/layout/page-heading";
import { ProfileSettingsForm } from "./profile-settings-form";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Settings for every role. Phase 5 adds account, payout and consent sections. */
export async function SettingsScreen({ children }: { children?: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const metadata = user?.user_metadata ?? {};
  const { data: profile } = user
    ? await createAdminClient()
        .from("profiles")
        .select("first_name,last_name,birthday,mobile,account_type,business_name,avatar_path")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeading}>
        <PageHeading title="Settings" description="Manage your account, password, and display preferences." />
      </div>
      <div className={styles.settingsGrid}>
        {user && <ProfileSettingsForm
          key={user.id}
          email={user.email ?? ""}
          initialProfile={{
            first_name: profile?.first_name || stringMetadata(metadata.first_name),
            last_name: profile?.last_name || stringMetadata(metadata.last_name),
            birthday: profile?.birthday || stringMetadata(metadata.birthday),
            mobile: profile?.mobile || stringMetadata(metadata.mobile),
            account_type: profile?.account_type ?? accountTypeMetadata(metadata.account_type),
            business_name: profile?.business_name || stringMetadata(metadata.business_name),
            avatar_path: profile?.avatar_path ?? null,
          }}
          initialAvatarUrl={profile?.avatar_path ? await signedAvatarUrl(supabase, profile.avatar_path) : null}
        />}
        <AppearanceSettings />
        <section className={`${styles.section} ${styles.password}`} aria-labelledby="password-heading">
          <h2 id="password-heading" className={styles.sectionTitle}>Change password</h2>
          <PasswordSettingsForm />
        </section>
      </div>
      {children && <div className={styles.additional}>{children}</div>}
    </div>
  );
}

function stringMetadata(value: unknown) {
  return typeof value === "string" ? value : "";
}

function accountTypeMetadata(value: unknown): "household" | "business" {
  return value === "business" ? "business" : "household";
}

async function signedAvatarUrl(supabase: Awaited<ReturnType<typeof createClient>>, path: string) {
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
