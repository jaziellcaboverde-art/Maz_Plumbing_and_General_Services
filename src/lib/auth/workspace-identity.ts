import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** React cache deduplicates only within this request, never between signed-in users. */
export const loadWorkspaceIdentity = cache(async () => {
  await connection();
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const { data: profile, error: profileError } = user
    ? await client
        .from("profiles")
        .select("role,first_name,last_name,avatar_path")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null, error: null };
  return { client, user, profile, profileError };
});
