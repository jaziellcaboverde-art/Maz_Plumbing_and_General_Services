import "server-only";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/roles";
export async function workflowSession(role: "customer" | "admin") {
  await connection();
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error } = await client
    .from("profiles")
    .select("role,first_name")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !profile)
    throw new Error("Could not verify workspace access. Please refresh.");
  if (profile?.role !== role)
    redirect(`/${(profile?.role as Role) ?? "customer"}`);
  return { client, user, profile };
}
