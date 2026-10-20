import { createClient } from "@/lib/supabase/server";

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in as an administrator." }, { status: 401 });
  const { data: actor } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") return Response.json({ error: "Administrator access is required." }, { status: 403 });

  let body: { nbiClearanceRequired?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: "The submitted requirement could not be read." }, { status: 400 }); }
  if (typeof body.nbiClearanceRequired !== "boolean") {
    return Response.json({ error: "Choose whether NBI clearance is required." }, { status: 400 });
  }
  const { data: updated, error } = await supabase.from("config").update({ value: body.nbiClearanceRequired })
    .eq("key", "provider.nbi_clearance_required").select("key").maybeSingle();
  if (error || !updated) return Response.json({ error: "Could not save the provider hiring requirement. Apply the provider requirements migration first." }, { status: 500 });
  return Response.json({ ok: true });
}
