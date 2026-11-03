import { createAdminClient } from "@/lib/supabase/admin";
// Check consent on every request. Original private evidence paths never leave the server.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^\d$/.test(index))
    return new Response(null, { status: 404 });
  const admin = createAdminClient();
  const { data: e, error } = await admin
    .from("project_portfolio_entries")
    .select("booking_id,photo_paths,published")
    .eq("id", id)
    .maybeSingle();
  if (error || !e?.published) return new Response(null, { status: 404 });
  const [{ data: c }, { data: b }] = await Promise.all([
    admin
      .from("project_publication_consents")
      .select("photos_allowed")
      .eq("booking_id", e.booking_id)
      .maybeSingle(),
    admin
      .from("bookings")
      .select("official_status")
      .eq("id", e.booking_id)
      .maybeSingle(),
  ]);
  const path = e.photo_paths[Number(index)];
  if (!c?.photos_allowed || b?.official_status !== "Completed" || !path)
    return new Response(null, { status: 404 });
  const { data: file } = await admin.storage
    .from("proof-photos")
    .download(path);
  if (!file || !file.type.startsWith("image/"))
    return new Response(null, { status: 404 });
  return new Response(file, {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
