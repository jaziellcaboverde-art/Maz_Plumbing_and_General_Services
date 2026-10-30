import { deliverNotifications } from "@/lib/matching/engine";
import { databaseError, requireUser, UUID } from "@/lib/matching/http";

/** 10.2: the provider taps On the way. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Booking not found." }, { status: 404 });
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.session.rpc("start_travel", { p_booking_id: id });
  if (error) return databaseError(error, "Could not start the trip. Try again.");
  await deliverNotifications((data as { notify?: unknown } | null)?.notify);
  return Response.json({ ok: true });
}
