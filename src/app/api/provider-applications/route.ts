import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications/send";
import { isMetroManilaArea } from "@/lib/location/metro-manila";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf",
};

export async function POST(request: Request) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return Response.json({ error: "Sign in before submitting your application." }, { status: 401 });
  const admin = createAdminClient();
  const { data: nbiPolicy, error: nbiPolicyError } = await admin.from("config").select("value").eq("key", "provider.nbi_clearance_required").maybeSingle();
  if (nbiPolicyError) return Response.json({ error: "Could not verify the provider document requirements. Try again later." }, { status: 503 });
  const nbiClearanceRequired = nbiPolicy?.value === true;
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || profile.role === "admin" || profile.role === "provider") {
    return Response.json({ error: "This account cannot submit a provider application." }, { status: 403 });
  }
  const { data: existing } = await admin.from("provider_profiles").select("status").eq("profile_id", user.id).maybeSingle();
  if (existing) return Response.json({ error: "An application already exists for this account." }, { status: 409 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({ error: "The submitted form could not be read." }, { status: 400 }); }
  const areas = form.getAll("service_areas").map(String);
  const area = areas.join(", ");
  const dailyRate = Number(form.get("daily_rate"));
  const emergencyName = String(form.get("emergency_contact_name") ?? "").trim();
  const emergencyPhone = String(form.get("emergency_contact_phone") ?? "").trim();
  const latitude = Number(form.get("latitude"));
  const longitude = Number(form.get("longitude"));
  const baseAddress = String(form.get("base_address") ?? "").trim();
  const ids = form.getAll("service_ids").map(String);
  const idFile = form.get("government_id");
  const selfieFile = form.get("selfie");
  const nbiFile = form.get("nbi_clearance");
  const addressFile = form.get("proof_of_address");
  const skillFile = form.get("skill_certificate");
  const years = Number(form.get("years_experience"));
  const refs = [1, 2].map((n) => ({ name: String(form.get(`reference_${n}_name`) ?? "").trim(), phone: String(form.get(`reference_${n}_phone`) ?? "").trim() }));
  if (!areas.length || new Set(areas).size !== areas.length || !areas.every(isMetroManilaArea) ||
      !Number.isFinite(dailyRate) || dailyRate < 0 || dailyRate > 1_000_000 ||
      !emergencyName ||
      !/^\+639\d{9}$/.test(emergencyPhone) || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      !baseAddress || baseAddress.length > 500 ||
      latitude < 4 || latitude > 21.5 || longitude < 115 || longitude > 127 || form.get("consent") !== "yes") {
    return Response.json({ error: "Check the service area, rate, base location, emergency contact, and consent fields." }, { status: 400 });
  }
  if (!ids.length || new Set(ids).size !== ids.length || !ids.every((value) => /^[0-9a-f-]{36}$/i.test(value))) {
    return Response.json({ error: "Choose at least one valid service." }, { status: 400 });
  }
  const proofFiles = new Map<string, File[]>();
  for (const id of ids) {
    const list = form.getAll(`proof_${id}`).filter((v): v is File => v instanceof File);
    if (list.length < 1 || list.length > 3 || list.some((f) => !MIME_EXT[f.type] || f.size <= 0 || f.size > 10 * 1024 * 1024)) {
      return Response.json({ error: "Every service needs 1 to 3 proof files (JPG, PNG, WebP or PDF, up to 10 MB each)." }, { status: 400 });
    }
    proofFiles.set(id, list);
  }
  if (!(idFile instanceof File) || !(selfieFile instanceof File)) {
    return Response.json({ error: "Upload both a government ID and a selfie holding your ID." }, { status: 400 });
  }
  if (!(addressFile instanceof File)) return Response.json({ error: "Upload a barangay clearance or proof of address." }, { status: 400 });
  if (skillFile !== null && !(skillFile instanceof File)) return Response.json({ error: "The skills certificate upload is invalid." }, { status: 400 });
  if (!Number.isInteger(years) || years < 0 || years > 60) return Response.json({ error: "Enter your years of experience (0 to 60)." }, { status: 400 });
  if (refs.some((r) => !r.name || r.name.length > 120 || !/^\+639\d{9}$/.test(r.phone)) || refs[0].phone === refs[1].phone) {
    return Response.json({ error: "Enter two different references with a name and a +63 mobile number each." }, { status: 400 });
  }
  if (nbiFile !== null && !(nbiFile instanceof File)) return Response.json({ error: "The NBI clearance upload is invalid." }, { status: 400 });
  if (nbiClearanceRequired && !(nbiFile instanceof File)) return Response.json({ error: "NBI clearance is required by the current provider hiring policy." }, { status: 400 });
  if (!nbiClearanceRequired && nbiFile instanceof File) return Response.json({ error: "NBI clearance is not being collected for this application." }, { status: 400 });
  const validFile = (file: File, max: number, pdf: boolean) => Boolean(MIME_EXT[file.type]) && (pdf || file.type !== "application/pdf") && file.size > 0 && file.size <= max;
  if (!validFile(idFile, 10 * 1024 * 1024, true) || !validFile(selfieFile, 5 * 1024 * 1024, false)) {
    return Response.json({ error: "One or more files have an unsupported type or size." }, { status: 400 });
  }
  if (!validFile(addressFile, 10 * 1024 * 1024, true) || (skillFile instanceof File && !validFile(skillFile, 10 * 1024 * 1024, true))) {
    return Response.json({ error: "The address proof or skills certificate has an unsupported type or size." }, { status: 400 });
  }
  if (nbiFile instanceof File && !validFile(nbiFile, 10 * 1024 * 1024, true)) {
    return Response.json({ error: "The NBI clearance file has an unsupported type or size." }, { status: 400 });
  }
  const geoKey = process.env.GEOAPIFY_API_KEY;
  if (!geoKey) return Response.json({ error: "Location validation is unavailable. Contact the admin before submitting." }, { status: 503 });
  const reverseUrl = new URL("https://api.geoapify.com/v1/geocode/reverse");
  reverseUrl.searchParams.set("lat", String(latitude));
  reverseUrl.searchParams.set("lon", String(longitude));
  reverseUrl.searchParams.set("type", "city");
  reverseUrl.searchParams.set("format", "json");
  reverseUrl.searchParams.set("limit", "1");
  reverseUrl.searchParams.set("apiKey", geoKey);
  let isNcr = false;
  try {
    const reverse = await fetch(reverseUrl, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!reverse.ok) return Response.json({ error: "Could not verify the base location. Try again." }, { status: 502 });
    const geo = await reverse.json() as { results?: Array<{ country_code?: string; state?: string; state_code?: string; city?: string; county?: string }> };
    const place = geo.results?.[0];
    const state = `${place?.state ?? ""} ${place?.state_code ?? ""}`.toLowerCase();
    const ncrState = state.includes("metro manila") || state.includes("national capital region") || /\bncr\b/.test(state);
    const localArea = [place?.city, place?.county].some((name) => name ? isMetroManilaArea(name) : false);
    isNcr = place?.country_code?.toLowerCase() === "ph" && (ncrState || localArea);
  } catch {
    return Response.json({ error: "Could not verify the base location. Check your connection and try again." }, { status: 502 });
  }
  if (!isNcr) return Response.json({ error: "Choose a base location within Metro Manila." }, { status: 400 });
  const { data: services } = await admin.from("services").select("id").eq("active", true).in("id", ids);
  if (!services || services.length !== ids.length) return Response.json({ error: "One or more selected services are unavailable." }, { status: 400 });

  const storagePaths: { bucket: string; path: string; kind: string }[] = [];
  const uploads: [File, "ids" | "selfies", "government_id" | "selfie" | "nbi_clearance" | "proof_of_address" | "skill_certificate"][] = [
    [idFile, "ids", "government_id"], [selfieFile, "selfies", "selfie"], [addressFile, "ids", "proof_of_address"],
  ];
  if (skillFile instanceof File) uploads.push([skillFile, "ids", "skill_certificate"]);
  if (nbiFile instanceof File) uploads.push([nbiFile, "ids", "nbi_clearance"]);
  for (const [file, bucket, kind] of uploads) {
    const path = `${user.id}/${randomUUID()}.${MIME_EXT[file.type]}`;
    const { error } = await admin.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      await Promise.all(storagePaths.map(({ bucket: savedBucket, path: savedPath }) => admin.storage.from(savedBucket).remove([savedPath])));
      return Response.json({ error: `Could not store the ${kind === "selfie" ? "selfie" : "ID"} file.` }, { status: 500 });
    }
    storagePaths.push({ bucket, path, kind });
  }

  const claimPaths = new Map<string, string[]>();
  for (const [serviceId, list] of proofFiles) {
    for (const file of list) {
      const path = `${user.id}/claims/${randomUUID()}.${MIME_EXT[file.type]}`;
      const { error } = await admin.storage.from("ids").upload(path, file, { contentType: file.type, upsert: false });
      if (error) return rollback("Could not store a proof file.");
      storagePaths.push({ bucket: "ids", path, kind: "claim" });
      claimPaths.set(serviceId, [...(claimPaths.get(serviceId) ?? []), path]);
    }
  }

  const meta = user.user_metadata ?? {};
  // People who signed up with Google have no birthday or mobile in their account yet, so the form sends them.
  const field = (key: string, fallback: unknown) => String(form.get(`account_${key}`) ?? fallback ?? "").trim();
  const firstName = field("first_name", meta.first_name ?? meta.given_name);
  const lastName = field("last_name", meta.last_name ?? meta.family_name);
  const birthday = field("birthday", meta.birthday);
  const mobile = field("mobile", meta.mobile);
  const birthdayDate = new Date(`${birthday}T00:00:00`);
  const adultDate = new Date(birthdayDate);
  adultDate.setFullYear(adultDate.getFullYear() + 18);
  if (!firstName || !lastName || !/^\+639\d{9}$/.test(mobile) || !birthday || Number.isNaN(birthdayDate.valueOf()) || adultDate > new Date()) {
    return rollback("Account details must include your name, valid date of birth (18+), and a valid mobile number.");
  }
  const profileUpdate = await admin.from("profiles").update({
    first_name: firstName, last_name: lastName, birthday, mobile,
  }).eq("id", user.id);
  if (profileUpdate.error) return rollback("Could not save your account details.");

  const { error: applicationError } = await admin.from("provider_profiles").insert({
    profile_id: user.id, status: "pending", service_area: area, daily_rate: dailyRate, base_address: baseAddress,
    emergency_contact_name: emergencyName, emergency_contact_phone: emergencyPhone,
    years_experience: years, reference_1_name: refs[0].name, reference_1_phone: refs[0].phone,
    reference_2_name: refs[1].name, reference_2_phone: refs[1].phone,
    // PostGIS geography columns accept EWKT here. Keep longitude first, then latitude.
    base_location: `SRID=4326;POINT(${longitude} ${latitude})`, document_consent_at: new Date().toISOString(),
  });
  if (applicationError) {
    console.error("Provider application insert failed:", applicationError.code, applicationError.message);
    return rollback("Could not create the provider application.");
  }
  // The services stay "claimed" until an admin approves each one with its proof (migration 20261028120000).
  const { error: serviceError } = await admin.from("provider_service_claims").insert(ids.map((service_id) => ({ provider_id: user.id, service_id, proof_paths: claimPaths.get(service_id) ?? [] })));
  const { error: documentError } = await admin.from("provider_documents").insert(storagePaths.filter(({ kind }) => kind !== "claim").map(({ kind, path }) => ({ provider_id: user.id, kind, storage_path: path })));
  if (serviceError || documentError) {
    await admin.from("provider_profiles").delete().eq("profile_id", user.id);
    await admin.from("provider_service_claims").delete().eq("provider_id", user.id);
    await admin.from("provider_documents").delete().eq("provider_id", user.id);
    return rollback("Could not finish saving the application. Please try again.");
  }
  await admin.rpc("write_audit", {
    p_actor: user.id, p_action: "provider_application.submit", p_target_table: "provider_profiles",
    p_target_id: user.id, p_reason: null, p_details: { service_count: ids.length },
  });
  try {
    await sendNotification({ profileId: user.id, event: "provider_application.submitted", title: "Application received", body: "Your provider application was sent to the admin team for review.", link: "/provider-application", channels: ["in_app"] });
  } catch { /* Submission is saved; delivery failures are not allowed to undo the application. */ }
  return Response.json({ ok: true }, { status: 201 });

  async function rollback(message: string) {
    await Promise.all(storagePaths.map(({ bucket, path }) => admin.storage.from(bucket).remove([path])));
    return Response.json({ error: message }, { status: 500 });
  }
}
