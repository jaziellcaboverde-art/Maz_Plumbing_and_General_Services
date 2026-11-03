import {
  databaseError,
  readBody,
  requireUser,
  UUID,
} from "@/lib/matching/http";
import { parseWorkflowAction } from "@/lib/workflow/rules";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await readBody(request);
  const parsed = parseWorkflowAction(body?.action, body?.data);
  if (!UUID.test(id) || !parsed)
    return Response.json(
      { error: "Check the action and required fields." },
      { status: 400 },
    );
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.session.rpc("managed_booking_action", {
    p_booking: id,
    p_action: parsed.action,
    p_data: parsed.data,
  });
  if (error)
    return databaseError(
      error,
      "Could not save this action. Please refresh and try again.",
    );
  return Response.json(data ?? { ok: true });
}
