import {
  readBody,
  requireUser,
  databaseError,
  UUID,
} from "@/lib/matching/http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await readBody(request);
  if (!UUID.test(id) || typeof body?.accept !== "boolean")
    return Response.json(
      { error: "Choose a quote response." },
      { status: 400 },
    );
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data: quote } = await auth.session
    .from("quotes")
    .select("booking_id,version")
    .eq("id", id)
    .maybeSingle();
  if (!quote)
    return Response.json({ error: "Quote not found." }, { status: 404 });
  const { data, error } = await auth.session.rpc("managed_booking_action", {
    p_booking: quote.booking_id,
    p_action: "respond_quote",
    p_data: {
      id,
      version: body.version ?? quote.version,
      accept: body.accept,
      note: typeof body.reason === "string" ? body.reason : "",
    },
  });
  return error
    ? databaseError(error, "Could not save your quote response.")
    : Response.json(data);
}
