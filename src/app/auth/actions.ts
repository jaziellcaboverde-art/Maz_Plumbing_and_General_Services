"use server";

import { createClient } from "@supabase/supabase-js";

// Initialize Supabase using your service role key securely on the server side
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Make sure this is added to your .env.local
);

export async function handleAdminSignup(formData: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  birthday: string;
  mobile: string;
}) {
  const { email, password, firstName, lastName, birthday, mobile } = formData;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // BYPASSES THE EMAIL VERIFICATION COMPLETELY
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      birthday,
      mobile,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
