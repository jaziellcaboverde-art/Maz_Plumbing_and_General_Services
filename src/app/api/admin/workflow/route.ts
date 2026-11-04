import { readBody, requireAdmin, databaseError } from "@/lib/matching/http";
import {
  adminOperations,
  type AdminOperation,
} from "@/lib/workflow/admin-rules";
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = await readBody(request);
  const op = body?.operation;
  if (typeof op !== "string" || !Object.hasOwn(adminOperations, op))
    return Response.json(
      { error: "Choose a supported operation." },
      { status: 400 },
    );
  const parsed = adminOperations[op as AdminOperation].safeParse(body?.data);
  if (!parsed.success)
    return Response.json(
      { error: "Check the required fields." },
      { status: 400 },
    );
  const d = parsed.data;
  let result;
  if ("policy" in d)
    result = await auth.session.rpc("configure_managed_service", {
      p_service: d.serviceId,
      p_policy: d.policy,
      p_due: d.due,
    });
  else if ("instructions" in d)
    result = await auth.session.rpc("configure_maz_payment_instructions", {
      p_method: d.method,
      p_instructions: d.instructions,
    });
  else if ("customerId" in d)
    result = await auth.session.rpc("admin_create_managed_booking", {
      p_customer: d.customerId,
      p_service: d.serviceId,
      p_address: d.addressId,
      p_description: d.description,
      p_start: d.start,
      p_source: d.source,
    });
  else if ("customerName" in d)
    result = await auth.session.rpc("admin_create_manual_booking", {
      p_customer_name: d.customerName,
      p_customer_mobile: d.customerMobile,
      p_customer_address: d.customerAddress,
      p_service: d.serviceId,
      p_description: d.description,
      p_start: d.start,
      p_source: d.source,
    });
  else
    result = await auth.session.rpc("moderate_project_publication", {
      p_kind: d.kind,
      p_id: d.id,
      p_hide: d.hide,
      p_note: d.note,
    });
  if (result.error)
    return databaseError(result.error, "Could not save the MAZ operation.");
  return Response.json({ ok: true, id: result.data });
}
