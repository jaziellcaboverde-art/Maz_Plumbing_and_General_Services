import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PAYOUT_METHODS = ["gcash", "bank", "cash"] as const;

export async function PUT(request: Request) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to update payout details." }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: profile }, { data: provider }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    admin.from("provider_profiles").select("status").eq("profile_id", user.id).maybeSingle(),
  ]);
  if (profile?.role !== "provider" || provider?.status !== "approved") {
    return Response.json({ error: "Payout details are available only to approved providers." }, { status: 403 });
  }

  let body: { method?: unknown; accountName?: unknown; accountNumber?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: "The submitted payout details could not be read." }, { status: 400 }); }
  const method = typeof body.method === "string" ? body.method : "";
  const accountName = typeof body.accountName === "string" ? body.accountName.trim() : "";
  const accountNumber = typeof body.accountNumber === "string" ? body.accountNumber.trim() : "";
  if (!(PAYOUT_METHODS as readonly string[]).includes(method)) {
    return Response.json({ error: "Choose GCash, bank transfer, or cash." }, { status: 400 });
  }
  if (method !== "cash" && (!accountName || accountName.length > 120 || !accountNumber || accountNumber.length > 80)) {
    return Response.json({ error: "Enter the account holder name and account number." }, { status: 400 });
  }

  const { error } = await admin.from("provider_profiles").update({
    payout_method: method,
    payout_account_name: method === "cash" ? null : accountName,
    payout_account_number: method === "cash" ? null : accountNumber,
  }).eq("profile_id", user.id).eq("status", "approved");
  if (error) return Response.json({ error: "Could not save payout details. Try again." }, { status: 500 });

  await admin.rpc("write_audit", {
    p_actor: user.id,
    p_action: "provider.payout.update",
    p_target_table: "provider_profiles",
    p_target_id: user.id,
    p_reason: null,
    p_details: { payout_method: method },
  });
  return Response.json({ ok: true });
}
