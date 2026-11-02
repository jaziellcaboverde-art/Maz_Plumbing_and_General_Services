import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function authorized(request: Request) {
  const expected = process.env.PROVIDER_DOCUMENT_CLEANUP_SECRET ?? "";
  const value = request.headers.get("authorization") ?? "";
  const supplied = value.startsWith("Bearer ") ? value.slice(7) : "";
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected); const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Run daily from a scheduler. Rejected applicant files are removed on/after delete_after. */
export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: expired, error } = await admin
    .from("provider_documents")
    .select("id,provider_id,kind,storage_path,delete_after")
    .lte("delete_after", today);
  if (error) return Response.json({ error: `Could not load expired documents: ${error.message}` }, { status: 500 });
  const providerIds = [...new Set((expired ?? []).map((doc) => doc.provider_id))];
  const { data: rejected, error: statusError } = providerIds.length
    ? await admin.from("provider_profiles").select("profile_id").eq("status", "rejected").in("profile_id", providerIds)
    : { data: [], error: null };
  if (statusError) return Response.json({ error: `Could not check application status: ${statusError.message}` }, { status: 500 });
  const rejectedIds = new Set((rejected ?? []).map((row) => row.profile_id));
  let deleted = 0;
  const failures: string[] = [];
  for (const doc of expired ?? []) {
    if (!rejectedIds.has(doc.provider_id)) continue;
    const bucket = doc.kind === "selfie" ? "selfies" : "ids";
    const { error: storageError } = await admin.storage.from(bucket).remove([doc.storage_path]);
    if (storageError) { failures.push(doc.id); continue; }
    const { error: rowError } = await admin.from("provider_documents").delete().eq("id", doc.id);
    if (rowError) failures.push(doc.id); else deleted += 1;
  }
  if (deleted) await admin.rpc("write_audit", {
    p_actor: null, p_action: "provider_application.expired_documents_deleted", p_target_table: "provider_documents",
    p_target_id: null, p_reason: null, p_details: { deleted, failures: failures.length },
  });
  return Response.json({ ok: failures.length === 0, deleted, failed: failures.length });
}
