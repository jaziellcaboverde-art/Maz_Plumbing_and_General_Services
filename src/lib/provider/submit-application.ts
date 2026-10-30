import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNotification } from "@/lib/notifications/send";
import { isMetroManilaArea } from "@/lib/location/metro-manila";
import { EXTENSION_BY_MIME, resolveMime, slotFor, type DocumentKind } from "./documents";

/** Proof files and the old upload form allow up to 10 MB. The apply popup asks for 5 MB. */
const PROOF_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Validate a provider application form, store its files privately, and save the application as pending.
 * Shared by the signed-in submit route and the one-page apply route, so both enforce the same rules.
 * The caller has already proven who the applicant is (userId) and that they may apply.
 */
export async function submitProviderApplication({ admin, userId, userMetadata, form }: {
  admin: SupabaseClient;
  userId: string;
  userMetadata: Record<string, unknown>;
  form: FormData;
}): Promise<Response> {
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
  const resumeFile = form.get("resume");
  const medicalFile = form.get("medical_certificate");
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
    if (list.length < 1 || list.length > 3 || list.some((f) => !resolveMime(f) || f.size <= 0 || f.size > PROOF_MAX_BYTES)) {
      return Response.json({ error: "Every service needs 1 to 3 proof files (PDF, DOC, DOCX, PNG, JPG or WebP, up to 10 MB each)." }, { status: 400 });
    }
    proofFiles.set(id, list);
  }
  if (!(idFile instanceof File) || !(selfieFile instanceof File)) {
    return Response.json({ error: "Upload both a government ID and a selfie holding your ID." }, { status: 400 });
  }
  if (!(addressFile instanceof File)) return Response.json({ error: "Upload a barangay clearance or proof of address." }, { status: 400 });
  if (skillFile !== null && !(skillFile instanceof File)) return Response.json({ error: "The skills certificate upload is invalid." }, { status: 400 });
  if ((resumeFile !== null && !(resumeFile instanceof File)) || (medicalFile !== null && !(medicalFile instanceof File))) return Response.json({ error: "The resume or medical certificate upload is invalid." }, { status: 400 });
  if (!Number.isInteger(years) || years < 0 || years > 60) return Response.json({ error: "Enter your years of experience (0 to 60)." }, { status: 400 });
  if (refs.some((r) => !r.name || r.name.length > 120 || !/^\+639\d{9}$/.test(r.phone)) || refs[0].phone === refs[1].phone) {
    return Response.json({ error: "Enter two different references with a name and a +63 mobile number each." }, { status: 400 });
  }
  if (!(nbiFile instanceof File)) return Response.json({ error: "Upload your NBI clearance. It is required." }, { status: 400 });
  // Each slot says which types it accepts (the selfie is image-only). Size is capped at 10 MB here; the popup asks for 5 MB.
  const validFile = (file: File, kind: DocumentKind) => {
    const slot = slotFor(kind);
    const mime = resolveMime(file);
    return Boolean(slot && mime && slot.types.includes(mime)) && file.size > 0 && file.size <= PROOF_MAX_BYTES;
  };
  if (!validFile(idFile, "government_id") || !validFile(selfieFile, "selfie")) {
    return Response.json({ error: "One or more files have an unsupported type or size." }, { status: 400 });
  }
  if (!validFile(addressFile, "proof_of_address") || (skillFile instanceof File && !validFile(skillFile, "skill_certificate"))) {
    return Response.json({ error: "The address proof or skills certificate has an unsupported type or size." }, { status: 400 });
  }
  if (!validFile(nbiFile, "nbi_clearance")) {
    return Response.json({ error: "The NBI clearance file has an unsupported type or size." }, { status: 400 });
  }
  if ((resumeFile instanceof File && !validFile(resumeFile, "resume")) || (medicalFile instanceof File && !validFile(medicalFile, "medical_certificate"))) {
    return Response.json({ error: "The resume or medical certificate has an unsupported type or size." }, { status: 400 });
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
  const uploads: [File, "ids" | "selfies", "government_id" | "selfie" | "nbi_clearance" | "proof_of_address" | "skill_certificate" | "resume" | "medical_certificate"][] = [
    [idFile, "ids", "government_id"], [selfieFile, "selfies", "selfie"], [addressFile, "ids", "proof_of_address"],
  ];
  if (skillFile instanceof File) uploads.push([skillFile, "ids", "skill_certificate"]);
  uploads.push([nbiFile, "ids", "nbi_clearance"]);
  if (resumeFile instanceof File) uploads.push([resumeFile, "ids", "resume"]);
  if (medicalFile instanceof File) uploads.push([medicalFile, "ids", "medical_certificate"]);
  for (const [file, bucket, kind] of uploads) {
    const path = `${userId}/${randomUUID()}.${EXTENSION_BY_MIME[resolveMime(file) ?? ""]}`;
    const { error } = await admin.storage.from(bucket).upload(path, file, { contentType: resolveMime(file) ?? file.type, upsert: false });
    if (error) {
      await Promise.all(storagePaths.map(({ bucket: savedBucket, path: savedPath }) => admin.storage.from(savedBucket).remove([savedPath])));
      return Response.json({ error: `Could not store the ${kind === "selfie" ? "selfie" : "ID"} file.` }, { status: 500 });
    }
    storagePaths.push({ bucket, path, kind });
  }

  const claimPaths = new Map<string, string[]>();
  for (const [serviceId, list] of proofFiles) {
    for (const file of list) {
      const path = `${userId}/claims/${randomUUID()}.${EXTENSION_BY_MIME[resolveMime(file) ?? ""]}`;
      const { error } = await admin.storage.from("ids").upload(path, file, { contentType: resolveMime(file) ?? file.type, upsert: false });
      if (error) return rollback("Could not store a proof file.");
      storagePaths.push({ bucket: "ids", path, kind: "claim" });
      claimPaths.set(serviceId, [...(claimPaths.get(serviceId) ?? []), path]);
    }
  }

  const meta = userMetadata;
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
  }).eq("id", userId);
  if (profileUpdate.error) return rollback("Could not save your account details.");

  const reference = `MAZ-${userId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const { error: applicationError } = await admin.from("provider_profiles").insert({
    profile_id: userId, status: "pending", service_area: area, daily_rate: dailyRate, base_address: baseAddress,
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
  const { error: serviceError } = await admin.from("provider_service_claims").insert(ids.map((service_id) => ({ provider_id: userId, service_id, proof_paths: claimPaths.get(service_id) ?? [] })));
  const { error: documentError } = await admin.from("provider_documents").insert(storagePaths.filter(({ kind }) => kind !== "claim").map(({ kind, path }) => ({ provider_id: userId, kind, storage_path: path })));
  if (serviceError || documentError) {
    await admin.from("provider_profiles").delete().eq("profile_id", userId);
    await admin.from("provider_service_claims").delete().eq("provider_id", userId);
    await admin.from("provider_documents").delete().eq("provider_id", userId);
    return rollback("Could not finish saving the application. Please try again.");
  }
  await admin.rpc("write_audit", {
    p_actor: userId, p_action: "provider_application.submit", p_target_table: "provider_profiles",
    p_target_id: userId, p_reason: null, p_details: { service_count: ids.length },
  });
  try {
    await sendNotification({ profileId: userId, event: "provider_application.submitted", title: "Application received", body: "Your provider application was sent to the admin team for review.", link: "/provider-application", channels: ["in_app"] });
  } catch { /* Submission is saved; delivery failures are not allowed to undo the application. */ }
  return Response.json({ ok: true, reference }, { status: 201 });

  async function rollback(message: string) {
    await Promise.all(storagePaths.map(({ bucket, path }) => admin.storage.from(bucket).remove([path])));
    return Response.json({ error: message }, { status: 500 });
  }
}
