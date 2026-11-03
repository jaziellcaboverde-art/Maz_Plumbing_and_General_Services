import {
  databaseError,
  readBody,
  requireUser,
  UUID,
} from "@/lib/matching/http";
import { deliverNotifications } from "@/lib/matching/engine";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await readBody(request);
  if (
    !UUID.test(id) ||
    !body ||
    typeof body.amount !== "number" ||
    !Number.isFinite(body.amount) ||
    typeof body.deposit !== "number" ||
    !Number.isFinite(body.deposit) ||
    typeof body.notes !== "string" ||
    typeof body.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(body.expiresAt))
  )
    return Response.json(
      {
        error: "Provide the scope, total, required deposit and validity date.",
      },
      { status: 400 },
    );
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.session.rpc("prepare_maz_quote", {
    p_booking: id,
    p_amount: body.amount,
    p_deposit: body.deposit,
    p_notes: body.notes,
    p_expires: body.expiresAt,
  });
  if (error) return databaseError(error, "Could not issue the quotation.");
  await deliverNotifications(data?.notify);
  return Response.json({ ok: true });
}
