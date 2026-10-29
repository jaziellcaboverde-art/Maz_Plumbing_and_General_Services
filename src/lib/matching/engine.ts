import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications/send";
import { parseNotifyIntents } from "./notify";
import {
  candidateFromRow,
  rankCandidates,
  rankingConfigFrom,
  type RankedCandidate,
  type RankingConfig,
} from "./score";

type Admin = ReturnType<typeof createAdminClient>;

export async function loadRankingConfig(admin: Admin = createAdminClient()): Promise<RankingConfig> {
  const { data, error } = await admin.from("config").select("key,value").like("key", "ranking.%");
  if (error) throw new Error("Could not read the ranking settings.");
  return rankingConfigFrom(data ?? []);
}

/** The ranked list for one booking. Urgent jobs use the urgent weights. */
export async function rankedCandidates(bookingId: string, admin: Admin = createAdminClient()): Promise<RankedCandidate[]> {
  const [{ data: booking, error: bookingError }, config] = await Promise.all([
    admin.from("bookings").select("is_urgent").eq("id", bookingId).maybeSingle(),
    loadRankingConfig(admin),
  ]);
  if (bookingError || !booking) throw new Error("Booking not found.");
  const { data, error } = await admin.rpc("matching_candidates", { p_booking_id: bookingId });
  if (error) throw new Error("Could not find providers for this booking.");
  const candidates = (data as Array<Record<string, unknown>> | null ?? []).map(candidateFromRow);
  const ranked = rankCandidates(candidates, booking.is_urgent ? "urgent" : "normal", config);
  // Step 7.6 and 7.26: keep every score and every list shown, so the weights can be tuned later.
  const { error: auditError } = await admin.rpc("write_audit", {
    p_actor: null,
    p_action: "matching.ranked",
    p_target_table: "bookings",
    p_target_id: bookingId,
    p_reason: null,
    p_details: {
      kind: booking.is_urgent ? "urgent" : "normal",
      list: ranked.map((r) => ({ provider_id: r.providerId, score: r.score, distance_m: r.distanceM, stars: r.stars, reliability: r.reliabilityScore, parts: r.parts })),
    },
  });
  if (auditError) console.error("Could not log the ranked list:", auditError.message);
  return ranked;
}

/** Send what the database asked for. A failed email must never undo an offer, so errors are logged. */
export async function deliverNotifications(notify: unknown): Promise<void> {
  const intents = parseNotifyIntents(notify);
  await Promise.all(intents.map(async (intent) => {
    try { await sendNotification(intent); }
    catch (error) { console.error("Could not send notification", intent.event, error); }
  }));
}

/** Tell approved providers who declared this service that a customer is looking. Sent once per booking. */
export async function alertMatchingProviders(bookingId: string, admin: Admin = createAdminClient()): Promise<void> {
  const { data, error } = await admin.rpc("alert_matching_providers", { p_booking_id: bookingId });
  if (error) { console.error("Could not alert matching providers:", error.message); return; }
  await deliverNotifications(data);
}

/** Normal jobs are assigned by an admin unless config `matching.customer_pick` is 1. */
export async function customerPicksProvider(admin: Admin = createAdminClient()): Promise<boolean> {
  const { data } = await admin.from("config").select("value").eq("key", "matching.customer_pick").maybeSingle();
  return Number(data?.value) === 1;
}

/** Offer the booking to the best provider on the ranked list who can still take it. */
export async function offerNextBest(bookingId: string, admin: Admin = createAdminClient()): Promise<"offered" | "admin" | "none"> {
  const ranked = await rankedCandidates(bookingId, admin);
  const { data, error } = await admin.rpc("offer_next_in_list", {
    p_booking_id: bookingId,
    p_provider_ids: ranked.map((c) => c.providerId),
  });
  if (error) throw new Error("Could not offer the job to the next provider.");
  const result = data as { next?: string; notify?: unknown } | null;
  await deliverNotifications(result?.notify);
  if (result?.next === "admin") await tellAdmins(bookingId, admin, true);
  return result?.next === "offered" || result?.next === "admin" ? result.next : "none";
}

/** The job is waiting for an admin. Tell the admins, and the customer when nobody else has. */
export async function tellAdmins(bookingId: string, admin: Admin, includeCustomer: boolean): Promise<void> {
  const [{ data: booking }, { data: admins }] = await Promise.all([
    admin.from("bookings").select("customer_id").eq("id", bookingId).maybeSingle(),
    admin.from("profiles").select("id").eq("role", "admin"),
  ]);
  const notify: unknown[] = (admins ?? []).map((a) => ({
    profile_id: a.id, event: "booking.needs_admin", title: "A job needs a provider",
    body: "Choose a provider from the ranked list in the assignments queue.", link: "/admin/assignments", channels: ["in_app"],
  }));
  if (booking && includeCustomer) {
    notify.push({
      profile_id: booking.customer_id, event: "booking.needs_admin_customer", title: "We are finding you a provider",
      body: "Our team will match your job and let you know.", link: `/customer/bookings/${bookingId}`, channels: ["in_app", "email"],
    });
  }
  await deliverNotifications(notify);
}

type Miss = { booking_id: string; provider_id: string; next: "auto" | "customer" | "admin" };

/** Close offers that ran out of time, then carry on according to who acts next. */
export async function processExpiredOffers(bookingId?: string, admin: Admin = createAdminClient()): Promise<number> {
  const { data, error } = await admin.rpc("expire_stale_offers", { p_booking_id: bookingId ?? null });
  if (error) throw new Error("Could not close timed out offers.");
  const misses = (Array.isArray(data) ? data : []) as Miss[];
  for (const miss of misses) {
    await deliverNotifications([{
      profile_id: miss.provider_id, event: "offer.expired", title: "An offer ran out of time",
      body: "You did not answer in time, so the job was offered to someone else.", link: "/provider", channels: ["in_app"],
    }]);
    if (miss.next === "auto") {
      await offerNextBest(miss.booking_id, admin);
    } else {
      const { data: booking } = await admin.from("bookings").select("customer_id").eq("id", miss.booking_id).maybeSingle();
      if (booking) {
        await deliverNotifications([{
          profile_id: booking.customer_id, event: "offer.expired_customer",
          title: miss.next === "admin" ? "We are finding you a provider" : "Please choose another provider",
          body: miss.next === "admin" ? "Our team will help match your job." : "The provider you picked did not answer in time.",
          link: `/customer/bookings/${miss.booking_id}`, channels: ["in_app", "email"],
        }]);
      }
      if (miss.next === "admin") await tellAdmins(miss.booking_id, admin, false);
    }
  }
  return misses.length;
}

export type AdminChoice = {
  providerId: string;
  name: string;
  stars: number | null;
  reviewCount: number;
  distanceM: number | null;
  dailyRate: number | null;
  ranked: boolean;
  /** The provider tapped "I can do this" on the open request. */
  interested?: boolean;
};

/**
 * Who an admin can offer a job to: the ranked list first, then other approved providers who do
 * the service but live farther away. Providers who already declined or timed out are left out.
 */
export async function adminChoices(bookingId: string, admin: Admin = createAdminClient()): Promise<AdminChoice[]> {
  const ranked = await rankedCandidates(bookingId, admin);
  const first: AdminChoice[] = ranked.map((c) => ({
    providerId: c.providerId, name: `${c.firstName} ${c.lastInitial}`.trim(), stars: c.isNew && c.reviewCount === 0 ? null : c.stars,
    reviewCount: c.reviewCount, distanceM: c.distanceM, dailyRate: c.dailyRate, ranked: true,
  }));
  const { data: interest } = await admin.from("job_interest").select("provider_id").eq("booking_id", bookingId);
  const interestedIds = new Set((interest ?? []).map((row) => row.provider_id as string));
  for (const choice of first) choice.interested = interestedIds.has(choice.providerId);
  const seen = new Set(first.map((c) => c.providerId));

  const { data: booking } = await admin.from("bookings").select("service_id").eq("id", bookingId).maybeSingle();
  if (!booking?.service_id) return first;
  const [{ data: offering }, { data: tried }] = await Promise.all([
    admin.from("provider_services").select("provider_id").eq("service_id", booking.service_id),
    admin.from("offers").select("provider_id").eq("booking_id", bookingId).in("status", ["declined", "expired"]),
  ]);
  const skip = new Set((tried ?? []).map((o) => o.provider_id as string));
  const ids = (offering ?? []).map((o) => o.provider_id as string).filter((id) => !seen.has(id) && !skip.has(id));
  if (ids.length === 0) return first;
  const { data: others } = await admin.from("provider_profiles")
    .select("profile_id,daily_rate,profiles(first_name,last_name)").in("profile_id", ids).eq("status", "approved")
    .returns<Array<{ profile_id: string; daily_rate: number | null; profiles: { first_name: string | null; last_name: string | null } | null }>>();
  const rest: AdminChoice[] = (others ?? []).map((o) => ({
    providerId: o.profile_id,
    name: `${o.profiles?.first_name ?? "Provider"} ${o.profiles?.last_name ? `${o.profiles.last_name[0]}.` : ""}`.trim(),
    stars: null, reviewCount: 0, distanceM: null, dailyRate: o.daily_rate === null ? null : Number(o.daily_rate), ranked: false, interested: interestedIds.has(o.profile_id),
  })).sort((a, b) => a.name.localeCompare(b.name));
  // Providers who said they can do the job come first inside each group.
  const byInterest = (list: AdminChoice[]) => [...list.filter((c) => c.interested), ...list.filter((c) => !c.interested)];
  return [...byInterest(first), ...byInterest(rest)];
}
