import { createClient } from "@/lib/supabase/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_SERVICES_TAG } from "@/lib/public/load-services";

type ServiceInput = {
  id?: unknown;
  category?: unknown;
  name?: unknown;
  defaultClass?: unknown;
  urgentAllowed?: unknown;
  active?: unknown;
  sortOrder?: unknown;
  description?: unknown;
  startingPrice?: unknown;
  imagePath?: unknown;
  reason?: unknown;
};

const SERVICE_COLUMNS = "id,category,name,default_class,urgent_allowed,active,sort_order,description,starting_price_php,image_path";
const BAD_INPUT = "Check the service name, description (400 characters at most), starting price and photo.";

async function requireAdmin() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { error: Response.json({ error: "Sign in as an administrator." }, { status: 401 }) };
  const { data: profile } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { error: Response.json({ error: "Administrator access is required." }, { status: 403 }) };
  return { session, user };
}

/** Reason for the activity log (spec BR-14). Needed to deactivate and to delete. 200 characters at most. */
function parseReason(input: ServiceInput) {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  return reason.length >= 1 && reason.length <= 200 ? reason : null;
}

/**
 * Reads only the fields that were sent, so the catalog card can save a name, a price, a photo
 * or a status without touching the rest. Returns null when something sent is invalid.
 */
function parseFields(input: ServiceInput) {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 120) return null;
    out.name = name;
  }
  if (input.category !== undefined) {
    const category = typeof input.category === "string" ? input.category.trim() : "";
    if (!category || category.length > 80) return null;
    out.category = category;
  }
  if (input.description !== undefined) {
    const description = typeof input.description === "string" ? input.description.trim() : "";
    if (description.length > 400) return null;
    out.description = description || null;
  }
  if (input.startingPrice !== undefined) {
    if (input.startingPrice === null || input.startingPrice === "") out.starting_price_php = null;
    else {
      const price = Number(input.startingPrice);
      if (!Number.isFinite(price) || price < 0 || price > 100000000) return null;
      out.starting_price_php = Math.round(price * 100) / 100;
    }
  }
  if (input.defaultClass !== undefined) {
    if (!["minor", "major"].includes(String(input.defaultClass))) return null;
    out.default_class = input.defaultClass;
  }
  if (input.urgentAllowed !== undefined) {
    if (typeof input.urgentAllowed !== "boolean") return null;
    out.urgent_allowed = input.urgentAllowed;
  }
  if (input.sortOrder !== undefined) {
    const sortOrder = Number(input.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) return null;
    out.sort_order = sortOrder;
  }
  if (input.active !== undefined) {
    if (typeof input.active !== "boolean") return null;
    out.active = input.active;
  }
  if (input.imagePath !== undefined) {
    if (input.imagePath === null) out.image_path = null;
    else if (typeof input.imagePath === "string" && /^[\w./-]{1,200}$/.test(input.imagePath) && !input.imagePath.includes("..")) out.image_path = input.imagePath;
    else return null;
  }
  return out;
}

async function readJson(request: Request): Promise<ServiceInput | null> {
  try { return await request.json(); } catch { return null; }
}

function audit(userId: string, action: string, id: string, reason: string | null, details: Record<string, unknown>) {
  return createAdminClient().rpc("write_audit", {
    p_actor: userId, p_action: action, p_target_table: "services", p_target_id: id, p_reason: reason, p_details: details,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const input = await readJson(request);
  if (!input) return Response.json({ error: "The service details could not be read." }, { status: 400 });
  const fields = parseFields(input);
  if (!fields || typeof fields.name !== "string") {
    return Response.json({ error: BAD_INPUT }, { status: 400 });
  }
  // The catalog card only asks for a name, description, starting price, photo and status.
  // Everything else gets a safe default until the owner decides where it is edited.
  const { data: last } = await auth.session.from("services").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const row = {
    category: fields.name, default_class: "minor", urgent_allowed: false, active: true,
    sort_order: (last?.sort_order ?? 0) + 1, ...fields,
  };
  const { data, error } = await auth.session.from("services").insert(row).select(SERVICE_COLUMNS).single();
  if (error) return Response.json({ error: error.code === "23505" ? "That service already exists." : "Could not add the service." }, { status: 400 });
  await audit(auth.user.id, "service.create", data.id, null, { category: data.category, name: data.name, active: data.active });
  revalidateTag(PUBLIC_SERVICES_TAG, "max");
  return Response.json({ service: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const input = await readJson(request);
  if (!input) return Response.json({ error: "The service details could not be read." }, { status: 400 });
  if (typeof input.id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.id)) {
    return Response.json({ error: "Choose a valid service." }, { status: 400 });
  }
  const fields = parseFields(input);
  if (!fields || !Object.keys(fields).length) return Response.json({ error: BAD_INPUT }, { status: 400 });
  const { data: before } = await auth.session.from("services").select("active,image_path").eq("id", input.id).maybeSingle();
  if (!before) return Response.json({ error: "That service no longer exists." }, { status: 404 });
  const reason = parseReason(input);
  if (before.active && fields.active === false && !reason) return Response.json({ error: "Give a reason for deactivating this service (200 characters at most)." }, { status: 400 });
  const { data, error } = await auth.session.from("services").update(fields).eq("id", input.id).select(SERVICE_COLUMNS).maybeSingle();
  if (error || !data) return Response.json({ error: error?.code === "23505" ? "That service already exists." : "Could not update the service." }, { status: 400 });
  const deactivated = before.active && !data.active;
  const action = deactivated ? "service.deactivate" : !before.active && data.active ? "service.activate" : "service.update";
  await audit(auth.user.id, action, data.id, deactivated ? reason : null, { category: data.category, name: data.name, active: data.active });
  // A replaced photo leaves the old file behind; remove it.
  if (before.image_path && before.image_path !== data.image_path) {
    await createAdminClient().storage.from("service-photos").remove([before.image_path]);
  }
  revalidateTag(PUBLIC_SERVICES_TAG, "max");
  return Response.json({ service: data });
}

/** Remove a service. Only an inactive service that was never booked. Otherwise it stays inactive. */
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const input = await readJson(request);
  if (!input) return Response.json({ error: "The request could not be read." }, { status: 400 });
  if (typeof input.id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.id)) {
    return Response.json({ error: "Choose a valid service." }, { status: 400 });
  }
  const reason = parseReason(input);
  if (!reason) return Response.json({ error: "Give a reason for removing this service (200 characters at most)." }, { status: 400 });
  const { data: service } = await auth.session.from("services").select("id,category,name,active,image_path").eq("id", input.id).maybeSingle();
  if (!service) return Response.json({ error: "That service no longer exists." }, { status: 404 });
  if (service.active) return Response.json({ error: "Deactivate this service first. Only an inactive service can be removed." }, { status: 409 });
  const { count } = await auth.session.from("bookings").select("id", { count: "exact", head: true }).eq("service_id", input.id);
  if (count) return Response.json({ error: `${service.name} has ${count} booking${count === 1 ? "" : "s"} on record, so it cannot be removed. It stays inactive and hidden.` }, { status: 409 });
  const { error } = await auth.session.from("services").delete().eq("id", input.id);
  if (error) {
    const used = error.code === "23503";
    return Response.json({ error: used ? `${service.name} is still used by other records, so it cannot be removed. It stays inactive and hidden.` : "Could not remove the service." }, { status: used ? 409 : 400 });
  }
  if (service.image_path) await createAdminClient().storage.from("service-photos").remove([service.image_path]);
  await audit(auth.user.id, "service.remove", service.id, reason, { category: service.category, name: service.name });
  revalidateTag(PUBLIC_SERVICES_TAG, "max");
  return Response.json({ removed: service.id });
}
