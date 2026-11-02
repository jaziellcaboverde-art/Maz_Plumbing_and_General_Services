import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AuditLogScreen, type AuditEvent } from "./audit-log-screen";

export default async function AuditLogPage() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") redirect("/customer");

  const admin = createAdminClient();
  const retainedSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await admin
    .from("audit_log")
    .select("id,actor_id,action,target_table,target_id,reason,details,created_at")
    .gte("created_at", retainedSince)
    .order("created_at", { ascending: false })
    .limit(1000);

  const actorIds = [...new Set((rows ?? []).map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = actorIds.length
    ? await admin.from("profiles").select("id,first_name,last_name").in("id", actorIds)
    : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, [profile.first_name, profile.last_name].filter(Boolean).join(" ")]));

  const events: AuditEvent[] = (rows ?? []).map((row) => ({
    id: String(row.id),
    actor: row.actor_id ? names.get(row.actor_id) || "Deleted account" : "System",
    actorId: row.actor_id,
    action: row.action,
    target: [row.target_table, row.target_id].filter(Boolean).join(" · ") || "—",
    targetTable: row.target_table,
    targetId: row.target_id,
    reason: row.reason,
    details: row.details,
    createdAt: row.created_at,
  }));

  return <AuditLogScreen events={events} loadError={error?.message ?? null} />;
}
