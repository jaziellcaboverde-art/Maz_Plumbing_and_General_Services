import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitProviderApplication } from "@/lib/provider/submit-application";

/**
 * A signed-in applicant submits their application. This path is for people who already have an account,
 * for example after Google sign up. The one-page form on /apply/provider uses ./apply instead.
 * All validation lives in submitProviderApplication.
 */
export async function POST(request: Request) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return Response.json({ error: "Sign in before submitting your application." }, { status: 401 });
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || profile.role === "admin" || profile.role === "provider") {
    return Response.json({ error: "This account cannot submit a provider application." }, { status: 403 });
  }
  const { data: existing } = await admin.from("provider_profiles").select("status").eq("profile_id", user.id).maybeSingle();
  if (existing) return Response.json({ error: "An application already exists for this account." }, { status: 409 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({ error: "The submitted form could not be read." }, { status: 400 }); }
  return submitProviderApplication({ admin, userId: user.id, userMetadata: user.user_metadata ?? {}, form });
}
