import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications/send";
import { sendProviderApprovalEmail } from "@/lib/notifications/provider-approval-email";

export async function POST(request: Request, { params }: { params: Promise<{ applicantId: string }> }) {
  const { applicantId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(applicantId)) return Response.json({ error: "Invalid applicant." }, { status: 400 });
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return Response.json({ error: "Sign in as an admin." }, { status: 401 });
  const admin = createAdminClient();
  const { data: actor } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") return Response.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { decision?: string; message?: string; approvedServiceIds?: unknown; interviewNotes?: unknown } | null;
  if (!body || !["approved", "rejected"].includes(body.decision ?? "")) return Response.json({ error: "Choose approve or reject." }, { status: 400 });
  const message = String(body.message ?? "").trim();
  if (body.decision === "rejected" && !message) return Response.json({ error: "Add a message explaining the rejection." }, { status: 400 });
  if (message.length > 1000) return Response.json({ error: "Keep the message under 1,000 characters." }, { status: 400 });
  const { data: application } = await admin.from("provider_profiles").select("status").eq("profile_id", applicantId).maybeSingle();
  if (!application || application.status !== "pending") return Response.json({ error: "This application is no longer pending." }, { status: 409 });
  const decision = body.decision as "approved" | "rejected";
  const interviewNotes = typeof body.interviewNotes === "string" ? body.interviewNotes.trim().slice(0, 1000) : "";
  const { data: claims } = await admin.from("provider_service_claims").select("service_id").eq("provider_id", applicantId);
  const claimedIds = (claims ?? []).map((c) => c.service_id as string);
  let approvedIds: string[] = claimedIds;
  if (decision === "approved") {
    // The admin picks which services are approved. Old applications without claims keep the old behaviour.
    if (claimedIds.length) {
      approvedIds = Array.isArray(body.approvedServiceIds) ? body.approvedServiceIds.map(String).filter((id) => claimedIds.includes(id)) : [];
      if (!approvedIds.length) return Response.json({ error: "Approve at least one service, or reject the application." }, { status: 400 });
    }
    const { data: interviewPolicy } = await admin.from("config").select("value").eq("key", "provider.interview_required").maybeSingle();
    if (interviewPolicy?.value === true && !interviewNotes) return Response.json({ error: "Add the interview or trial notes before approving." }, { status: 400 });
  }
  if (body.decision === "rejected") {
    await admin.from("provider_service_claims").update({ status: "rejected", decided_by: user.id, decided_at: new Date().toISOString() }).eq("provider_id", applicantId);
    const deleteAfter = new Date(); deleteAfter.setUTCDate(deleteAfter.getUTCDate() + 30);
    const { error: retentionError } = await admin.from("provider_documents").update({ delete_after: deleteAfter.toISOString().slice(0, 10) }).eq("provider_id", applicantId);
    if (retentionError) return Response.json({ error: "Could not set the rejected-document deletion date." }, { status: 500 });
  }
  const update: Record<string, unknown> = {
    status: decision, reviewed_by: user.id, reviewed_at: new Date().toISOString(),
    ...(interviewNotes ? { interview_notes: interviewNotes, interview_done_at: new Date().toISOString() } : {}),
    rejection_reason: decision === "rejected" ? message : null,
  };
  const { error: appError } = await admin.from("provider_profiles").update(update).eq("profile_id", applicantId);
  if (appError) return Response.json({ error: "Could not save the review." }, { status: 500 });
  if (decision === "approved") {
    const { error: roleError } = await admin.from("profiles").update({ role: "provider" }).eq("id", applicantId);
    if (roleError) {
      await admin.from("provider_profiles").update({ status: "pending", reviewed_by: null, reviewed_at: null }).eq("profile_id", applicantId);
      return Response.json({ error: "Could not activate the provider account. The application remains pending." }, { status: 500 });
    }
    await admin.from("provider_documents").update({ delete_after: null }).eq("provider_id", applicantId);
    if (claimedIds.length) {
      const now = new Date().toISOString();
      await admin.from("provider_services").upsert(approvedIds.map((service_id) => ({ provider_id: applicantId, service_id })), { onConflict: "provider_id,service_id" });
      await admin.from("provider_service_claims").update({ status: "approved", decided_by: user.id, decided_at: now }).eq("provider_id", applicantId).in("service_id", approvedIds);
      const rejectedIds = claimedIds.filter((id) => !approvedIds.includes(id));
      if (rejectedIds.length) await admin.from("provider_service_claims").update({ status: "rejected", decided_by: user.id, decided_at: now }).eq("provider_id", applicantId).in("service_id", rejectedIds);
    }
  }
  await admin.rpc("write_audit", {
    p_actor: user.id, p_action: `provider_application.${decision}`, p_target_table: "provider_profiles",
    p_target_id: applicantId, p_reason: decision === "rejected" ? message : null, p_details: {},
  });
  const title = decision === "approved" ? "Provider application approved" : "Provider application update";
  const defaultBody = decision === "approved" ? "Your provider account is active. Sign in again to open your provider dashboard." : "Your application was not approved. Read the admin message for details.";
  let approvalEmailSent = true;
  try {
    await sendNotification({ profileId: applicantId, event: `provider_application.${decision}`, title, body: decision === "rejected" ? `${defaultBody} ${message}` : "Your provider account is active. You can now open your provider dashboard.", link: "/provider-application", channels: decision === "approved" ? ["in_app"] : ["in_app", "email"] });
  } catch { /* The decision is saved even if notification delivery fails. */ }
  if (decision === "approved") {
    try {
      await sendProviderApprovalEmail(applicantId, String(update.reviewed_at));
    } catch {
      approvalEmailSent = false;
    }
  }
  return Response.json({ ok: true, approvalEmailSent });
}
