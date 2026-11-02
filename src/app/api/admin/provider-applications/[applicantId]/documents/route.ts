import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ applicantId: string }> }) {
  const { applicantId } = await params;
  const kind = new URL(request.url).searchParams.get("kind");
  if (!/^[0-9a-f-]{36}$/i.test(applicantId) || !kind) return Response.json({ error: "Invalid document request." }, { status: 400 });
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return Response.json({ error: "Sign in as an admin." }, { status: 401 });
  const admin = createAdminClient();
  const { data: actor } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") return Response.json({ error: "Admin access required." }, { status: 403 });
  const { data: doc } = await admin.from("provider_documents").select("kind,storage_path").eq("provider_id", applicantId).eq("kind", kind).maybeSingle();
  if (!doc) return Response.json({ error: "Document not found." }, { status: 404 });
  const bucket = doc.kind === "selfie" ? "selfies" : "ids";
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(doc.storage_path, 60);
  if (error || !data?.signedUrl) return Response.json({ error: "Could not create a private document link." }, { status: 500 });
  return Response.redirect(data.signedUrl);
}
