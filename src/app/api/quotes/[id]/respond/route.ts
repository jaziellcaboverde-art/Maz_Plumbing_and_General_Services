import { deliverNotifications } from "@/lib/matching/engine";
import { databaseError, readBody, requireUser, UUID } from "@/lib/matching/http";

/** The customer accepts or declines an approved quote. Accepting leads to the deposit (Q18). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  if (!UUID.test(id) || typeof body?.accept !== "boolean") return Response.json({ error: "Choose accept or decline." }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.session.rpc("respond_to_quote", { p_quote_id: id, p_accept: body.accept, p_reason: reason });
  if (error) return databaseError(error, "Could not save your answer. Try again.");
  const result = data as { outcome?: string; deposit_amount?: number; payment_tier?: string; notify?: unknown } | null;
  await deliverNotifications(result?.notify);
  return Response.json({ ok: true, outcome: result?.outcome ?? null, depositAmount: result?.deposit_amount ?? null, paymentTier: result?.payment_tier ?? null });
}
