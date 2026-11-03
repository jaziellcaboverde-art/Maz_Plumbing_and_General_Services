import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/roles";
export async function workflowSession(role: "customer" | "admin") {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await client
    .from("profiles")
    .select("role,first_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== role)
    redirect(`/${(profile?.role as Role) ?? "customer"}`);
  return { client, user, profile };
}
