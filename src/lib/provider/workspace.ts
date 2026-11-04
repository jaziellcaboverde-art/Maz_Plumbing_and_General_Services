import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/lib/booking/rules";
import { ownWorkCompleted } from "./rules";
import { loadWorkspaceIdentity } from "@/lib/auth/workspace-identity";

export const providerSession = cache(async () => {
  await connection();
  const { client, user, profile, profileError } = await loadWorkspaceIdentity();
  if (!user) redirect("/login?next=/provider");
  const { data: provider, error: providerError } = await client
    .from("provider_profiles")
    .select("status")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (profileError || providerError || !profile)
    throw new Error(
      "Could not verify provider workspace access. Please refresh.",
    );
  if (profile?.role !== "provider" || provider?.status !== "approved")
    redirect("/provider-application");
  return { client, user, firstName: profile.first_name as string };
});

export type ProviderJob = {
  id: string;
  status: BookingStatus;
  official_status: string;
  description: string | null;
  scheduled_start: string | null;
  preferred_start: string | null;
  updated_at: string;
  provider_id: string | null;
  services: { name: string } | null;
  ownWorkCompleted?: boolean;
};

export const loadProviderJobs = cache(async function loadProviderJobs(
  client: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: assignments, error } = await client
    .from("provider_assignments")
    .select("booking_id,status")
    .eq("provider_id", userId)
    .in("status", ["accepted", "withdrawal_requested", "completed"]);
  if (error) return { data: null, error };
  const ids = [
    ...new Set((assignments ?? []).map((row) => row.booking_id as string)),
  ];
  const result = await client
    .from("bookings")
    .select(
      "id,status,official_status,description,scheduled_start,preferred_start,updated_at,provider_id,services(name)",
    )
    .or(
      ids.length
        ? `provider_id.eq.${userId},id.in.(${ids.join(",")})`
        : `provider_id.eq.${userId}`,
    )
    .order("updated_at", { ascending: false })
    .returns<ProviderJob[]>();
  return {
    ...result,
    data:
      result.data?.map((job) => ({
        ...job,
        ownWorkCompleted: ownWorkCompleted(
          userId,
          job.provider_id,
          (assignments ?? [])
            .filter((a) => a.booking_id === job.id)
            .map((a) => a.status as string),
        ),
      })) ?? null,
  };
});
