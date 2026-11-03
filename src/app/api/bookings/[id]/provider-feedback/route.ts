import {
  databaseError,
  readBody,
  requireUser,
  UUID,
} from "@/lib/matching/http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await readBody(request);
  if (
    !UUID.test(id) ||
    typeof body?.providerId !== "string" ||
    !UUID.test(body.providerId) ||
    !Number.isInteger(body.stars) ||
    Number(body.stars) < 1 ||
    Number(body.stars) > 5 ||
    (body.comment != null &&
      (typeof body.comment !== "string" || body.comment.length > 2000))
  )
    return Response.json(
      { error: "Select an assigned worker and a rating from 1 to 5." },
      { status: 400 },
    );
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await auth.session.rpc("submit_private_provider_feedback", {
    p_booking: id,
    p_provider: body.providerId,
    p_stars: body.stars,
    p_comment: body.comment ?? null,
  });
  return error
    ? databaseError(error, "Could not save private worker feedback.")
    : Response.json({ ok: true });
}
