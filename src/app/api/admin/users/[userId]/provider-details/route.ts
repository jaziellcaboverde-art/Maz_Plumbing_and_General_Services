import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!UUID.test(userId)) return Response.json({ error: "Invalid user." }, { status: 400 });

  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return Response.json({ error: "Sign in as an admin." }, { status: 401 });

  const admin = createAdminClient();
  const { data: actor } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") return Response.json({ error: "Admin access required." }, { status: 403 });
  if (userId === user.id) return Response.json({ error: "You cannot remove your own account details." }, { status: 400 });

  const [{ data: target }, { data: provider }, { data: documents, error: documentsError }, { data: authUserResult, error: authUserError }, { data: activeBookings, error: bookingError }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", userId).maybeSingle(),
    admin.from("provider_profiles").select("profile_id").eq("profile_id", userId).maybeSingle(),
    admin.from("provider_documents").select("kind,storage_path").eq("provider_id", userId),
    admin.auth.admin.getUserById(userId),
    admin.from("bookings").select("id").or(`provider_id.eq.${userId},picked_provider_id.eq.${userId}`).not("status", "in", "(completed,cancelled)").limit(1),
  ]);
  if (target?.role !== "provider" || !provider) {
    return Response.json({ error: "This account does not have provider details to remove." }, { status: 409 });
  }
  if (documentsError) return Response.json({ error: "Could not load private provider documents." }, { status: 500 });
  if (bookingError) return Response.json({ error: "Could not check for unfinished bookings." }, { status: 500 });
  if (activeBookings?.length) return Response.json({ error: "Finish or reassign this provider's active bookings before removing provider details." }, { status: 409 });
  if (authUserError || !authUserResult.user) {
    return Response.json({ error: "Could not confirm the account record." }, { status: 500 });
  }

  const docs = documents ?? [];
  for (const bucket of ["ids", "selfies"] as const) {
    const paths = docs.filter((doc) => (doc.kind === "selfie" ? "selfies" : "ids") === bucket).map((doc) => doc.storage_path);
    if (!paths.length) continue;
    const { error } = await admin.storage.from(bucket).remove(paths);
    if (error) return Response.json({ error: "Could not remove all private provider documents. No account data was removed; retry this action." }, { status: 500 });
  }

  const { error: removalError } = await admin.rpc("admin_remove_provider_details", {
    p_actor: user.id,
    p_provider: userId,
  });
  if (removalError) {
    const activeBooking = removalError.message.toLowerCase().includes("active bookings");
    return Response.json({
      error: activeBooking
        ? "Finish or reassign this provider's active bookings before removing provider details."
        : "Could not remove provider details. Contact support if this continues.",
    }, { status: activeBooking ? 409 : 500 });
  }

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...authUserResult.user.app_metadata, role: "customer" },
  });

  return Response.json({ ok: true, sessionRefreshRequired: Boolean(authUpdateError) });
}
