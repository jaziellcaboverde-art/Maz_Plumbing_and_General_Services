import { deliverNotifications } from "@/lib/matching/engine";
import { databaseError, readBody, requireUser, UUID } from "@/lib/matching/http";
import { checkQuoteAmount } from "@/lib/quotes/rules";

/** Steps 9.3 and 9.7: the provider sends a quote, with milestones for a large job. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  if (!UUID.test(id) || !body) return Response.json({ error: "The quote is missing." }, { status: 400 });
  const amount = Number(body.amount);
  const amountError = checkQuoteAmount(amount);
  if (amountError) return Response.json({ error: amountError }, { status: 400 });
  if (body.jobClass !== "minor" && body.jobClass !== "major") return Response.json({ error: "Choose minor or major." }, { status: 400 });
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";
  if (notes.length < 10) return Response.json({ error: "Say what the price covers, at least 10 characters." }, { status: 400 });
  const milestones = Array.isArray(body.milestones)
    ? body.milestones.slice(0, 8).map((m) => {
        const row = (m ?? {}) as Record<string, unknown>;
        return { title: typeof row.title === "string" ? row.title.trim().slice(0, 120) : "", amount: Number(row.amount) };
      })
    : [];
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.session.rpc("propose_quote", {
    p_booking_id: id, p_amount: amount, p_class: body.jobClass, p_notes: notes, p_milestones: milestones,
  });
  if (error) return databaseError(error, "Could not send the quote. Try again.");
  const result = data as { quote_id?: string; tier?: string; notify?: unknown } | null;
  await deliverNotifications(result?.notify);
  return Response.json({ ok: true, quoteId: result?.quote_id ?? null, tier: result?.tier ?? null });
}
