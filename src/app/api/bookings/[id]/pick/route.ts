import { deliverNotifications, processExpiredOffers } from "@/lib/matching/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { databaseError, readBody, requireUser, UUID } from "@/lib/matching/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  const providerId = typeof body?.providerId === "string" ? body.providerId : "";
  if (!UUID.test(id) || !UUID.test(providerId)) return Response.json({ error: "Choose a provider from the list." }, { status: 400 });
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  // Close any timed out offer first so the booking is open again before the new pick.
  try { await processExpiredOffers(id, createAdminClient()); } catch (error) { console.error("expiry before pick failed", error); }

  const { data, error } = await auth.session.rpc("pick_provider", {
    p_booking_id: id, p_provider_id: providerId, p_auto_chain: body?.autoChain === true,
  });
  if (error) return databaseError(error, "Could not send your request to the provider. Try again.");
  await deliverNotifications((data as { notify?: unknown } | null)?.notify);
  return Response.json({ ok: true });
}
