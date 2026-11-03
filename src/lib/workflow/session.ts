import "server-only";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { loadWorkspaceIdentity } from "@/lib/auth/workspace-identity";
import type { Role } from "@/lib/auth/roles";
export async function workflowSession(role: "customer" | "admin") {
  await connection();
  const { client, user, profile, profileError } = await loadWorkspaceIdentity();
  if (!user) redirect("/login");
  if (profileError || !profile)
    throw new Error("Could not verify workspace access. Please refresh.");
  if (profile?.role !== role)
    redirect(`/${(profile?.role as Role) ?? "customer"}`);
  return { client, user, profile };
}
