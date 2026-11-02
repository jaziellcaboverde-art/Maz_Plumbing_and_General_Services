import type { SupabaseClient } from "@supabase/supabase-js";

export type ProviderSummary = {
  id: string;
  /** "Maria S." Only a first name and a last initial. Phone numbers stay private (open-questions Q46). */
  name: string;
  skills: string[];
  jobsDone: number;
  averageRating: number | null;
  reviewCount: number;
};

/**
 * What a customer may see about an assigned provider (spec 6.2): name, skills, finished jobs and average rating.
 * Reads with the server-side admin client because customers cannot read other people's profiles, and returns
 * nothing private.
 */
export async function loadProviderSummaries(admin: SupabaseClient, providerIds: string[]): Promise<Map<string, ProviderSummary>> {
  const ids = [...new Set(providerIds.filter(Boolean))];
  const result = new Map<string, ProviderSummary>();
  if (ids.length === 0) return result;

  const [{ data: profiles }, { data: skillRows }, { data: doneRows }, { data: reviewRows }] = await Promise.all([
    admin.from("profiles").select("id,first_name,last_name").in("id", ids),
    admin.from("provider_services").select("provider_id,services(name)").in("provider_id", ids),
    admin.from("bookings").select("provider_id").in("provider_id", ids).in("status", ["done", "signed", "balance_paid", "completed"]),
    admin.from("reviews").select("provider_id,stars").in("provider_id", ids).eq("hidden", false),
  ]);

  for (const profile of profiles ?? []) {
    const skills = (skillRows ?? [])
      .filter((row) => row.provider_id === profile.id)
      .flatMap((row) => {
        const service = row.services as { name: string } | { name: string }[] | null;
        const name = Array.isArray(service) ? service[0]?.name : service?.name;
        return name ? [name] : [];
      });
    const stars = (reviewRows ?? []).filter((row) => row.provider_id === profile.id).map((row) => Number(row.stars));
    result.set(profile.id, {
      id: profile.id,
      name: `${profile.first_name ?? "Provider"}${profile.last_name ? ` ${profile.last_name[0]}.` : ""}`,
      skills,
      jobsDone: (doneRows ?? []).filter((row) => row.provider_id === profile.id).length,
      averageRating: stars.length ? stars.reduce((sum, value) => sum + value, 0) / stars.length : null,
      reviewCount: stars.length,
    });
  }
  return result;
}
