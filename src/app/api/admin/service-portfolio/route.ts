import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "service-portfolio";
const MAX_BYTES = 5 * 1024 * 1024;
const MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function adminAccess() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { error: Response.json({ error: "Sign in first." }, { status: 401 }) };
  const { data: profile } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { error: Response.json({ error: "Admin only." }, { status: 403 }) };
  return { user, db: createAdminClient() };
}

export async function POST(request: Request) {
  const auth = await adminAccess();
  if ("error" in auth) return auth.error;
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Invalid upload." }, { status: 400 });
  const serviceId = form.get("serviceId");
  const caption = String(form.get("caption") ?? "").trim();
  const file = form.get("file");
  if (typeof serviceId !== "string" || !UUID.test(serviceId) || caption.length > 180 || !(file instanceof File) || !MIME[file.type] || file.size < 1 || file.size > MAX_BYTES) {
    return Response.json({ error: "Choose a JPG, PNG or WebP under 5 MB, with a caption of 180 characters or less." }, { status: 400 });
  }
  const db = auth.db;
  const { data: service } = await db.from("services").select("id").eq("id", serviceId).maybeSingle();
  if (!service) return Response.json({ error: "Service not found." }, { status: 404 });
  const { count } = await db.from("service_portfolio").select("id", { count: "exact", head: true }).eq("service_id", serviceId);
  if ((count ?? 0) >= 12) return Response.json({ error: "Maximum 12 photos per service." }, { status: 400 });
  // Check file signatures, not only the browser-supplied MIME type.
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = file.type === "image/jpeg" && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const png = file.type === "image/png" && [137,80,78,71,13,10,26,10].every((byte, index) => header[index] === byte);
  const webp = file.type === "image/webp" && String.fromCharCode(...header.slice(0,4)) === "RIFF" && String.fromCharCode(...header.slice(8,12)) === "WEBP";
  if (!jpeg && !png && !webp) return Response.json({ error: "The uploaded file is not a valid JPG, PNG or WebP image." }, { status: 400 });
  const path = `${serviceId}/${crypto.randomUUID()}.${MIME[file.type]}`;
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return Response.json({ error: "Photo upload failed. Apply the service portfolio migration first." }, { status: 400 });
  const { data, error } = await db.from("service_portfolio").insert({ service_id: serviceId, image_path: path, caption, sort_order: count ?? 0 })
    .select("id,image_path,caption,sort_order").single();
  if (error) {
    await db.storage.from(BUCKET).remove([path]);
    return Response.json({ error: "Could not save the photo." }, { status: 400 });
  }
  return Response.json({ photo: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await adminAccess();
  if ("error" in auth) return auth.error;
  const input = await request.json().catch(() => null);
  if (!input || typeof input.id !== "string" || !UUID.test(input.id) || typeof input.caption !== "string" || input.caption.trim().length > 180 || !Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 1000) {
    return Response.json({ error: "Invalid photo details." }, { status: 400 });
  }
  const { data, error } = await auth.db.from("service_portfolio").update({ caption: input.caption.trim(), sort_order: input.sortOrder }).eq("id", input.id)
    .select("id,image_path,caption,sort_order").maybeSingle();
  if (error || !data) return Response.json({ error: "Could not update photo." }, { status: 400 });
  return Response.json({ photo: data });
}

export async function DELETE(request: Request) {
  const auth = await adminAccess();
  if ("error" in auth) return auth.error;
  const input = await request.json().catch(() => null);
  if (!input || typeof input.id !== "string" || !UUID.test(input.id)) return Response.json({ error: "Invalid photo." }, { status: 400 });
  const { data } = await auth.db.from("service_portfolio").select("id,image_path").eq("id", input.id).maybeSingle();
  if (!data) return Response.json({ error: "Photo not found." }, { status: 404 });
  const { error } = await auth.db.from("service_portfolio").delete().eq("id", input.id);
  if (error) return Response.json({ error: "Could not delete photo." }, { status: 400 });
  await auth.db.storage.from(BUCKET).remove([data.image_path]);
  return Response.json({ ok: true });
}
