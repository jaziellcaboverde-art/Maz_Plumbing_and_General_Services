import { z } from "zod";
import {
  databaseError,
  readBody,
  requireAdmin,
  UUID,
} from "@/lib/matching/http";

const searchSchema = z.object({
  providerIds: z
    .array(z.string().uuid())
    .min(1)
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  after: z.string().datetime(),
  duration: z
    .number()
    .int()
    .min(30)
    .max(480)
    .refine((n) => n % 30 === 0),
  buffer: z.number().int().min(0).max(240),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = searchSchema.safeParse(await readBody(request));
  if (!UUID.test(id) || !parsed.success)
    return Response.json(
      { error: "Choose workers, an offer deadline and work duration." },
      { status: 400 },
    );
  const { providerIds, from, after, duration, buffer } = parsed.data;
  const { data, error } = await auth.session.rpc("admin_available_team_slots", {
    p_booking: id,
    p_providers: providerIds,
    p_from: from,
    p_after: after,
    p_days: 14,
    p_duration: duration,
    p_buffer: buffer,
  });
  if (error)
    return databaseError(
      error,
      "Could not load available schedules. Please retry.",
    );
  return Response.json(
    {
      slots: (data ?? []).map(
        (slot: { starts_at: string; ends_at: string }) => ({
          starts_at: new Date(slot.starts_at).toISOString(),
          ends_at: new Date(slot.ends_at).toISOString(),
        }),
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
