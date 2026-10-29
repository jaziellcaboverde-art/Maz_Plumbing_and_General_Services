/**
 * Quote, tier and deposit rules (Phase 9). Pure, so the screens and the tests share them.
 * The database functions propose_quote and decide_quote repeat every rule on the server, and
 * the same thresholds live in the config table (keys tiers, deposit.percent_by_tier, large.split).
 */

export type PaymentTier = "minor" | "standard" | "large";

export type TierConfig = {
  minorBelow: number;
  largeFrom: number;
  /** Percent of the quote paid before the job is scheduled, per tier (Q26). */
  depositPercent: Record<PaymentTier, number>;
  /** Large jobs: percent of the quote paid across the milestones. */
  milestonePercent: number;
  milestoneMin: number;
  milestoneMax: number;
};

/** Same values the migration seeds. Used when a config row is missing. */
export const DEFAULT_TIER_CONFIG: TierConfig = {
  minorBelow: 20000,
  largeFrom: 80000,
  depositPercent: { minor: 100, standard: 50, large: 50 },
  milestonePercent: 40,
  milestoneMin: 2,
  milestoneMax: 4,
};

export const TIER_LABELS: Record<PaymentTier, string> = {
  minor: "Minor job",
  standard: "Standard job",
  large: "Large job",
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Large is the quote at or above the large threshold, or any large (major) job. Minor is below the minor threshold. */
export function paymentTierFor(amount: number, isMajor: boolean, config: TierConfig = DEFAULT_TIER_CONFIG): PaymentTier {
  if (isMajor || amount >= config.largeFrom) return "large";
  if (amount < config.minorBelow) return "minor";
  return "standard";
}

/** Amount paid through the system before the job is scheduled. Minor jobs are paid in full. */
export function depositFor(amount: number, tier: PaymentTier, config: TierConfig = DEFAULT_TIER_CONFIG): number {
  return round2((amount * config.depositPercent[tier]) / 100);
}

/** What is still to pay after the deposit. Zero for a minor job. */
export function remainingAfterDeposit(amount: number, tier: PaymentTier, config: TierConfig = DEFAULT_TIER_CONFIG): number {
  return round2(amount - depositFor(amount, tier, config));
}

/** Large jobs: the total the milestones must add up to. */
export function milestoneTarget(amount: number, config: TierConfig = DEFAULT_TIER_CONFIG): number {
  return round2((amount * config.milestonePercent) / 100);
}

export type MilestoneInput = { title: string; amount: number };

/** Returns a message to show, or null when the milestones are fine. */
export function checkMilestones(items: MilestoneInput[], amount: number, config: TierConfig = DEFAULT_TIER_CONFIG): string | null {
  if (items.length < config.milestoneMin || items.length > config.milestoneMax) {
    return `A large job needs ${config.milestoneMin} to ${config.milestoneMax} milestones.`;
  }
  for (const item of items) {
    const title = item.title.trim();
    if (title.length < 5 || title.length > 120) return "Each milestone needs a title of 5 to 120 characters.";
    if (!Number.isFinite(item.amount) || item.amount <= 0) return "Each milestone needs an amount above zero.";
  }
  const sum = round2(items.reduce((total, item) => total + item.amount, 0));
  const target = milestoneTarget(amount, config);
  if (Math.abs(sum - target) > 0.01) {
    return `Milestones must add up to ${formatPeso(target)}. They add up to ${formatPeso(sum)}.`;
  }
  return null;
}

export const QUOTE_MIN = 1;
export const QUOTE_MAX = 10_000_000;

export function checkQuoteAmount(amount: number): string | null {
  if (!Number.isFinite(amount) || amount < QUOTE_MIN || amount > QUOTE_MAX) return "Enter a price between 1 and 10,000,000 pesos.";
  return null;
}

const pesoFormat = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
export function formatPeso(amount: number): string {
  return pesoFormat.format(amount);
}

/** Plain sentence for the customer about how they will pay. */
export function paymentPlanText(amount: number, tier: PaymentTier, config: TierConfig = DEFAULT_TIER_CONFIG): string {
  const deposit = depositFor(amount, tier, config);
  if (tier === "minor") return `You pay the full ${formatPeso(deposit)} now, before the job is scheduled.`;
  if (tier === "standard") return `You pay a ${formatPeso(deposit)} deposit now (${config.depositPercent.standard}%). The rest, ${formatPeso(amount - deposit)}, is paid when the job is done.`;
  const holdback = round2(amount - deposit - milestoneTarget(amount, config));
  return `You pay a ${formatPeso(deposit)} deposit now (${config.depositPercent.large}%). ${formatPeso(milestoneTarget(amount, config))} is paid as milestones are confirmed, and ${formatPeso(holdback)} is held until the job is signed off.`;
}
