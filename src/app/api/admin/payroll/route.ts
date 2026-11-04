import { z } from "zod";
import { databaseError, readBody, requireAdmin } from "@/lib/matching/http";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    providerId: z.string().uuid(),
    weekEnding: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    workDayIds: z.array(z.string().uuid()).min(1).max(100),
  }),
  z.object({
    action: z.literal("mark-paid"),
    batchId: z.string().uuid(),
    reference: z.string().trim().min(3).max(120),
  }),
]);

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await readBody(request);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Check the selected workdays or payout reference." },
      { status: 400 },
    );
  }

  const result =
    parsed.data.action === "create"
      ? await auth.session.rpc("admin_create_provider_payout_batch", {
          p_provider: parsed.data.providerId,
          p_week_ending: parsed.data.weekEnding,
          p_work_day_ids: parsed.data.workDayIds,
        })
      : await auth.session.rpc("admin_mark_provider_payout_batch_paid", {
          p_batch: parsed.data.batchId,
          p_reference: parsed.data.reference,
        });

  if (result.error)
    return databaseError(result.error, "Could not save the provider payout.");
  return Response.json({ ok: true, result: result.data });
}
