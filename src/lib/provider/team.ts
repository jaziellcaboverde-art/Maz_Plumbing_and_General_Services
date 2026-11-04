import { z } from "zod";

/** A standard service determines the trade; renovation teams define their own roles. */
export function defaultWorkerTrade(
  category?: string,
  renovation = false,
): string | undefined {
  if (!category || renovation || category.toLowerCase() === "renovation")
    return undefined;
  const trades: Record<string, string> = {
    plumbing: "Plumber",
    drainage: "Drainage technician",
    electrical: "Electrician",
    aircon: "Air-conditioning technician",
    emergency: "Emergency service technician",
    painting: "Painter",
    waterproofing: "Waterproofing technician",
    cabinetry: "Cabinet installer",
    roofing: "Roofer",
    carpentry: "Carpenter",
  };
  return (
    trades[category.toLowerCase()] ?? `${category} specialist`.slice(0, 120)
  );
}
export const teamOfferSchema = z
  .object({
    workers: z
      .array(
        z.object({
          providerId: z.string().uuid(),
          trade: z.string().trim().min(2).max(120),
        }),
      )
      .min(1)
      .max(50),
    phase: z.enum(["inspection", "execution"]),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    travelMinutes: z.number().int().min(0).max(240).default(30),
    key: z.string().uuid(),
  })
  .refine(
    (d) =>
      new Set(d.workers.map((w) => w.providerId)).size === d.workers.length,
    { message: "Select each worker once." },
  )
  .refine(
    (d) =>
      Date.parse(d.endsAt) > Date.parse(d.startsAt) &&
      Date.parse(d.startsAt) > Date.parse(d.expiresAt),
    {
      message:
        "Work must start after the offer deadline and end after it starts.",
    },
  );
export type TeamAssignment = {
  provider_id: string;
  phase: string;
  status: string;
  trade: string;
};
export function acceptedTeamLeads(
  assignments: TeamAssignment[],
  providers: { id: string; label: string }[],
  phase: string,
  legacyLead: string | null,
  legacyAccepted: string[],
) {
  const eligible = assignments.filter(
    (a) => a.status === "accepted" && a.phase === phase,
  );
  const leads = eligible.flatMap((a) => {
    const p = providers.find((p) => p.id === a.provider_id);
    return p ? [{ id: p.id, label: `${p.label} - ${a.trade}` }] : [];
  });
  // Compatibility with earlier bookings whose acceptance is stored in offers.
  if (
    legacyLead &&
    legacyAccepted.includes(legacyLead) &&
    !assignments.some(
      (a) => a.provider_id === legacyLead && a.phase === phase,
    ) &&
    !leads.some((l) => l.id === legacyLead)
  ) {
    const p = providers.find((p) => p.id === legacyLead);
    if (p) leads.push({ id: p.id, label: `${p.label} - accepted lead` });
  }
  return leads;
}
