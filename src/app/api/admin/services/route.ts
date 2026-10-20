import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ServiceInput = {
  id?: unknown;
  category?: unknown;
  name?: unknown;
  defaultClass?: unknown;
  urgentAllowed?: unknown;
  active?: unknown;
  sortOrder?: unknown;
};

async function requireAdmin() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { error: Response.json({ error: "Sign in as an administrator." }, { status: 401 }) };
  const { data: profile } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { error: Response.json({ error: "Administrator access is required." }, { status: 403 }) };
  return { session, user };
}

function parseService(input: ServiceInput) {
  const category = typeof input.category === "string" ? input.category.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const defaultClass = input.defaultClass;
  const sortOrder = Number(input.sortOrder);
  if (!category || category.length > 80 || !name || name.length > 120 || !["minor", "major"].includes(String(defaultClass)) ||
      typeof input.urgentAllowed !== "boolean" || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000 ||
      (input.active !== undefined && typeof input.active !== "boolean")) return null;
  return {
    category, name, default_class: defaultClass as "minor" | "major",
    urgent_allowed: input.urgentAllowed, active: input.active ?? true, sort_order: sortOrder,
  };
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  let input: ServiceInput;
  try { input = await request.json(); }
  catch { return Response.json({ error: "The service details could not be read." }, { status: 400 }); }
  const service = parseService(input);
  if (!service) return Response.json({ error: "Check the category, service name, job class, urgency option, and display order." }, { status: 400 });
  const { data, error } = await auth.session.from("services").insert(service)
    .select("id,category,name,default_class,urgent_allowed,active,sort_order").single();
  if (error) return Response.json({ error: error.code === "23505" ? "That service already exists in this category." : "Could not add the service." }, { status: 400 });
  await createAdminClient().rpc("write_audit", {
    p_actor: auth.user.id, p_action: "service.create", p_target_table: "services", p_target_id: data.id,
    p_reason: null, p_details: { category: data.category, name: data.name },
  });
  return Response.json({ service: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  let input: ServiceInput;
  try { input = await request.json(); }
  catch { return Response.json({ error: "The service details could not be read." }, { status: 400 }); }
  if (typeof input.id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.id)) {
    return Response.json({ error: "Choose a valid service." }, { status: 400 });
  }
  const service = parseService(input);
  if (!service) return Response.json({ error: "Check the category, service name, job class, urgency option, and display order." }, { status: 400 });
  const { data, error } = await auth.session.from("services").update(service).eq("id", input.id)
    .select("id,category,name,default_class,urgent_allowed,active,sort_order").maybeSingle();
  if (error || !data) return Response.json({ error: error?.code === "23505" ? "That service already exists in this category." : "Could not update the service." }, { status: 400 });
  await createAdminClient().rpc("write_audit", {
    p_actor: auth.user.id, p_action: "service.update", p_target_table: "services", p_target_id: data.id,
    p_reason: null, p_details: { category: data.category, name: data.name, active: data.active },
  });
  return Response.json({ service: data });
}
