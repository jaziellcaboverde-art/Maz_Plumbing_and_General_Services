import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TIER_CONFIG, type TierConfig } from "@/lib/quotes/rules";

type Admin = ReturnType<typeof createAdminClient>;

const num = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

/** Reads the tier, deposit and milestone settings from the config table. Missing rows use the defaults. */
export async function loadTierConfig(admin: Admin = createAdminClient()): Promise<TierConfig> {
  const { data } = await admin.from("config").select("key,value")
    .in("key", ["tiers", "deposit.percent_by_tier", "large.split", "quote.milestone_count"]);
  const byKey = new Map((data ?? []).map((row) => [row.key as string, row.value as Record<string, unknown> | null]));
  const d = DEFAULT_TIER_CONFIG;
  const tiers = byKey.get("tiers") ?? {};
  const pct = byKey.get("deposit.percent_by_tier") ?? {};
  const split = byKey.get("large.split") ?? {};
  const count = byKey.get("quote.milestone_count") ?? {};
  return {
    minorBelow: num(tiers.minor_below, d.minorBelow),
    largeFrom: num(tiers.large_from, d.largeFrom),
    depositPercent: {
      minor: num(pct.minor, d.depositPercent.minor),
      standard: num(pct.standard, d.depositPercent.standard),
      large: num(pct.large, d.depositPercent.large),
    },
    milestonePercent: num(split.milestones, d.milestonePercent),
    milestoneMin: num(count.min, d.milestoneMin),
    milestoneMax: num(count.max, d.milestoneMax),
  };
}
