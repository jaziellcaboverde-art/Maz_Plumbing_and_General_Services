import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const INTERNAL_LINK = /^\/(?!\/)[^\s\\]*$/;

export async function POST(request: Request) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return Response.json({ error: "Sign in as an administrator." }, { status: 401 });
  const { data: profile } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return Response.json({ error: "Administrator access is required." }, { status: 403 });

  let input: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body.");
    input = body as Record<string, unknown>;
  } catch {
    return Response.json({ error: "The announcement details could not be read." }, { status: 400 });
  }
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const link = typeof input.link === "string" ? input.link.trim() : "";
  const audience = input.audience;
  const requiresAck = input.requiresAck === true;
  if (!title || title.length > 120 || !body || body.length > 4000 ||
      !["all", "customers", "providers"].includes(String(audience)) ||
      (link && (link.length > 500 || !INTERNAL_LINK.test(link)))) {
    return Response.json({ error: "Check the title, message, audience, and optional in-app link." }, { status: 400 });
  }

  const admin = createAdminClient();
  let recipients: ("customer" | "provider")[] = ["customer", "provider"];
  if (audience === "customers") recipients = ["customer"];
  if (audience === "providers") recipients = ["provider"];
  const { data: profiles, error: profileError } = await admin.from("profiles").select("id").in("role", recipients);
  if (profileError) return Response.json({ error: "Audience could not be loaded. Try again." }, { status: 500 });
  if (!profiles?.length) return Response.json({ sent: 0 });

  const { error } = await admin.from("notifications").insert(profiles.map((recipient) => ({
    profile_id: recipient.id,
    event: "announcement.broadcast",
    category: "announcement",
    title,
    body,
    link: link || null,
    requires_ack: requiresAck,
  })));
  if (error) return Response.json({ error: "The announcement could not be published." }, { status: 500 });
  return Response.json({ sent: profiles.length }, { status: 201 });
}
