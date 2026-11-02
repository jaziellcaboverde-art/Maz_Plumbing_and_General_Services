import { createAdminClient } from "@/lib/supabase/admin";
import { alertMatchingProviders, offerNextBest, processExpiredOffers, tellAdmins } from "@/lib/matching/engine";
import { requireUser, UUID } from "@/lib/matching/http";

/**
 * Called right after a booking is submitted and again whenever the booking page opens.
 * Urgent jobs start offering down the ranked list. Everything else does nothing here.
 * It is safe to call more than once: a job that already has an open offer is left alone.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Booking not found." }, { status: 404 });
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { data: booking } = await auth.session.from("bookings")
    .select("id,status,is_urgent,job_class,needs_admin").eq("id", id).eq("customer_id", auth.user.id).maybeSingle();
  if (!booking) return Response.json({ error: "Booking not found." }, { status: 404 });

  try {
    const admin = createAdminClient();
    await processExpiredOffers(id, admin);
    const { data: fresh } = await admin.from("bookings").select("status,is_urgent,job_class,needs_admin").eq("id", id).maybeSingle();
    if (!fresh || fresh.status !== "open") return Response.json({ ok: true, state: fresh?.status ?? booking.status });

    if (!fresh.is_urgent && fresh.job_class !== "major") await alertMatchingProviders(id, admin);
    if (fresh.job_class === "major") {
      if (!fresh.needs_admin) {
        await admin.from("bookings").update({ needs_admin: true, needs_admin_reason: "Large job. Assign a foreman." }).eq("id", id);
        await tellAdmins(id, admin, false);
      }
      return Response.json({ ok: true, state: "admin" });
    }
    if (fresh.is_urgent && !fresh.needs_admin) {
      const next = await offerNextBest(id, admin);
      return Response.json({ ok: true, state: next });
    }
    return Response.json({ ok: true, state: fresh.needs_admin ? "admin" : "open" });
  } catch (error) {
    console.error("start-matching failed", error);
    return Response.json({ error: "Could not start matching. Try again in a moment." }, { status: 503 });
  }
}
