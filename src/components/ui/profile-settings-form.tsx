"use client";

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { Check, ImagePlus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import { createClient } from "@/lib/supabase/browser";
import { isPhMobile, PHONE_ERROR } from "@/lib/phone";
import styles from "./profile-settings-form.module.css";

type Profile = {
  first_name: string;
  last_name: string;
  birthday: string;
  mobile: string;
  account_type: "household" | "business";
  business_name: string;
  avatar_path: string | null;
};

function ageIsValid(birthday: string) {
  if (!birthday) return false;
  const date = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return false;
  const adultDate = new Date(date);
  adultDate.setFullYear(adultDate.getFullYear() + 18);
  return adultDate <= new Date();
}

export function ProfileSettingsForm({
  email,
  initialProfile,
  initialAvatarUrl,
}: {
  email: string;
  initialProfile: Profile;
  initialAvatarUrl: string | null;
}) {
  const [savedProfile, setSavedProfile] = useState(initialProfile);
  const [profile, setProfile] = useState(initialProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirty = useMemo(
    () => JSON.stringify(profile) !== JSON.stringify(savedProfile),
    [profile, savedProfile],
  );
  const initials = `${profile.first_name[0] ?? ""}${profile.last_name[0] ?? ""}`.toUpperCase() || "U";
  const displayName = [profile.first_name.trim(), profile.last_name.trim()].filter(Boolean).join(" ") || email;

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setError(null);
    setNotice(null);
  }

  function discardChanges() {
    setProfile(savedProfile);
    setError(null);
    setNotice(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !dirty) return;

    const firstName = profile.first_name.trim();
    const lastName = profile.last_name.trim();
    const mobile = profile.mobile.trim();
    const businessName = profile.business_name.trim();
    if (!firstName || !lastName) {
      setError("Enter your first and last name.");
      return;
    }
    if (!isPhMobile(mobile)) {
      setError(PHONE_ERROR);
      return;
    }
    if (!ageIsValid(profile.birthday)) {
      setError("Enter a valid date of birth. You must be at least 18 years old.");
      return;
    }
    if (profile.account_type === "business" && !businessName) {
      setError("Enter your business name.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Your session has expired. Log in again to save your profile.");

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          birthday: profile.birthday,
          mobile,
          account_type: profile.account_type,
          business_name: profile.account_type === "business" ? businessName : null,
        })
        .eq("id", user.id)
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error("Your profile could not be found. Please refresh and try again.");

      const normalized: Profile = {
        ...profile,
        first_name: firstName,
        last_name: lastName,
        mobile,
        business_name: profile.account_type === "business" ? businessName : "",
      };
      setProfile(normalized);
      setSavedProfile(normalized);
      setNotice("Your profile has been saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  async function changeAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Your profile picture must be 5 MB or smaller.");
      return;
    }

    setAvatarBusy(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();
    let uploadedPath: string | undefined;
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Your session has expired. Log in again to change your picture.");

      uploadedPath = `${user.id}/${crypto.randomUUID()}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(uploadedPath, file, {
        contentType: file.type,
        cacheControl: "3600",
      });
      if (uploadError) throw uploadError;

      const newAvatarPath = uploadedPath;
      const { data, error: urlError } = await supabase.storage.from("avatars").createSignedUrl(newAvatarPath, 60 * 60);
      if (urlError || !data?.signedUrl) throw urlError ?? new Error("Could not display the uploaded picture.");

      const { data: updated, error: updateError } = await supabase.from("profiles")
        .update({ avatar_path: newAvatarPath }).eq("id", user.id).select("id").maybeSingle();
      if (updateError) throw updateError;
      if (!updated) throw new Error("Your picture could not be saved to your profile. Refresh and try again.");

      const previousPath = profile.avatar_path;
      setProfile((current) => ({ ...current, avatar_path: newAvatarPath }));
      setSavedProfile((current) => ({ ...current, avatar_path: newAvatarPath }));
      setAvatarUrl(data.signedUrl);
      setNotice("Your profile picture has been updated.");
      if (previousPath) await supabase.storage.from("avatars").remove([previousPath]);
    } catch (caught) {
      if (uploadedPath) await supabase.storage.from("avatars").remove([uploadedPath]);
      setError(caught instanceof Error ? caught.message : "Could not upload your profile picture.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    if (avatarBusy || !profile.avatar_path) return;
    setAvatarBusy(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Your session has expired. Log in again to change your picture.");
      const previousPath = profile.avatar_path;
      const { data, error: updateError } = await supabase.from("profiles")
        .update({ avatar_path: null }).eq("id", user.id).select("id").maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error("Your picture could not be removed from your profile. Refresh and try again.");
      setProfile((current) => ({ ...current, avatar_path: null }));
      setSavedProfile((current) => ({ ...current, avatar_path: null }));
      setAvatarUrl(null);
      setNotice("Your profile picture has been removed.");
      await supabase.storage.from("avatars").remove([previousPath]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove your profile picture.");
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="profile-heading">
      <header className={styles.cardHeader}>
        <div className={styles.identity}>
          <div className={styles.avatar} aria-hidden="true">
            {avatarUrl ? <Image src={avatarUrl} alt="" fill sizes="3.5rem" unoptimized /> : initials}
          </div>
          <div className={styles.headerCopy}>
            <h2 id="profile-heading">{displayName}</h2>
            <p>{profile.account_type === "business" && profile.business_name ? profile.business_name : "MAZ account profile"}</p>
          </div>
        </div>
        <div className={styles.pictureColumn}>
          <div className={styles.avatarActions}>
            <input ref={fileInput} className={styles.fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={changeAvatar} />
            <Button type="button" onClick={() => fileInput.current?.click()} loading={avatarBusy} disabled={avatarBusy}>
              <ImagePlus aria-hidden="true" /> {avatarUrl ? "Change photo" : "Upload photo"}
            </Button>
            {avatarUrl && <Button type="button" onClick={removeAvatar} disabled={avatarBusy}>Remove</Button>}
          <span className={styles.avatarHint}>JPG, PNG, or WebP; up to 5 MB</span>
          </div>
        </div>
      </header>

      <form className={styles.form} onSubmit={save}>
        <div className={styles.sectionIntro}>
          <div>
            <h3>Personal information</h3>
            <p>These details are used for your bookings and account.</p>
          </div>
        </div>

        <div className={styles.fields}>
          <Input label="First name" autoComplete="given-name" value={profile.first_name}
            onChange={(event) => update("first_name", event.target.value)} required />
          <Input label="Last name" autoComplete="family-name" value={profile.last_name}
            onChange={(event) => update("last_name", event.target.value)} required />
          <Input label="Date of birth" type="date" autoComplete="bday" value={profile.birthday}
            onChange={(event) => update("birthday", event.target.value)} required />
          <PhoneInput label="Mobile number" value={profile.mobile}
            onValueChange={(full) => update("mobile", full)} required />
          <Input label="Email address" type="email" autoComplete="email" value={email} disabled />
          <Select label="Account type" value={profile.account_type}
            onChange={(event) => update("account_type", event.target.value as Profile["account_type"])}>
            <option value="household">Household</option>
            <option value="business">Business</option>
          </Select>
          {profile.account_type === "business" && (
            <Input label="Business name" autoComplete="organization" value={profile.business_name}
              onChange={(event) => update("business_name", event.target.value)} required />
          )}
        </div>

        {error && <StatusMessage status="error">{error}</StatusMessage>}
        {notice && <StatusMessage status="success">{notice}</StatusMessage>}

        {dirty && (
          <div className={styles.saveBar} role="region" aria-label="Unsaved profile changes">
            <div className={styles.saveMessage}>
              <span className={styles.unsavedIcon} aria-hidden="true"><Check /></span>
              <span>You have unsaved changes</span>
            </div>
            <div className={styles.saveActions}>
              <Button type="button" onClick={discardChanges} disabled={busy}>
                <X aria-hidden="true" /> Discard
              </Button>
              <Button type="submit" variant="primary" loading={busy} disabled={busy}>
                <Save aria-hidden="true" /> Save changes
              </Button>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}
