import { Suspense } from "react";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProviderDecisionForm } from "./provider-decision-form";
import { DocumentPreview } from "./document-preview";
import { PageHeading } from "@/components/layout/page-heading";
import styles from "./review.module.css";

export default function ProviderApplicationReviewPage({ params }: { params: Promise<{ applicantId: string }> }) {
  return <Suspense fallback={<p>Loading provider application…</p>}><ProviderApplicationReviewContent params={params} /></Suspense>;
}

async function ProviderApplicationReviewContent({ params }: { params: Promise<{ applicantId: string }> }) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") redirect("/customer");
  const { applicantId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(applicantId)) notFound();
  const admin = createAdminClient();
  const [{ data: application }, { data: docs }, { data: services }, { data: profile }, { data: authUserResult }] = await Promise.all([
    admin.from("provider_profiles").select("*").eq("profile_id", applicantId).maybeSingle(),
    admin.from("provider_documents").select("id,kind,storage_path,created_at").eq("provider_id", applicantId),
    admin.from("provider_service_claims").select("service_id,status,proof_paths,services(category,name)").eq("provider_id", applicantId),
    admin.from("profiles").select("first_name,last_name,birthday,mobile").eq("id", applicantId).maybeSingle(),
    admin.auth.admin.getUserById(applicantId),
  ]);
  if (!application || !profile) notFound();
  const applicantEmail = authUserResult.user?.email;
  const claims = (services ?? []).map((entry: any) => {
    const service = Array.isArray(entry.services) ? entry.services[0] : entry.services;
    return { serviceId: entry.service_id as string, status: entry.status as string, proofCount: ((entry.proof_paths ?? []) as string[]).length,
      label: `${service?.category ?? "Service"} — ${service?.name ?? entry.service_id}` };
  });
  const serviceLabels = claims.map((c) => c.label);
  const interviewRequired = (await admin.from("config").select("value").eq("key", "provider.interview_required").maybeSingle()).data?.value === true;
  const point = getPointCoordinates(application.base_location);
  const baseAddress = application.base_address || await getAddressFromCoordinates(point);
  if (!application.base_address && baseAddress) {
    await admin.from("provider_profiles").update({ base_address: baseAddress }).eq("profile_id", applicantId);
  }
  const mapUrl = point
    ? `https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=15/${point.latitude}/${point.longitude}`
    : null;
  return <section className={styles.page}>
    <PageHeading
      title="Review provider application"
      description="Check the applicant details and verification documents before recording a decision."
      trailing={<span className={styles.status}>{application.status}</span>}
    />

    <section className={styles.card} aria-labelledby="applicant-details-title">
      <h2 id="applicant-details-title" className={styles.sectionTitle}>Applicant details</h2>
      <dl className={styles.details}>
        <div className={styles.field}><dt>First name</dt><dd>{profile.first_name || "Not provided"}</dd></div>
        <div className={styles.field}><dt>Last name</dt><dd>{profile.last_name || "Not provided"}</dd></div>
        <div className={styles.field}><dt>Date of birth</dt><dd>{profile.birthday ?? "Not provided"}</dd></div>
        <div className={styles.field}><dt>Mobile</dt><dd>{profile.mobile ?? "Not provided"}</dd></div>
        <div className={styles.field}><dt>Email</dt><dd>{applicantEmail ? <a href={`mailto:${applicantEmail}`}>{applicantEmail}</a> : "Not provided"}</dd></div>
        <div className={`${styles.field} ${styles.wide}`}><dt>Service area</dt><dd>{application.service_area ?? "Not provided"}</dd></div>
        <div className={styles.field}><dt>Expected daily rate</dt><dd>PHP {application.daily_rate ?? "Not provided"}</dd></div>
        <div className={`${styles.field} ${styles.wide}`}><dt>Base address</dt><dd>{baseAddress || "Address not available for this application"}{mapUrl && <> · <a href={mapUrl} target="_blank" rel="noreferrer">Open map</a></>}</dd></div>
        <div className={styles.field}><dt>Years of experience</dt><dd>{application.years_experience ?? "Not provided"}</dd></div>
        <div className={styles.field}><dt>Reference 1</dt><dd>{application.reference_1_name ? `${application.reference_1_name}, ${application.reference_1_phone}` : "Not provided"}</dd></div>
        <div className={styles.field}><dt>Reference 2</dt><dd>{application.reference_2_name ? `${application.reference_2_name}, ${application.reference_2_phone}` : "Not provided"}</dd></div>
        <div className={styles.field}><dt>Emergency contact name</dt><dd>{application.emergency_contact_name ?? "Not provided"}</dd></div>
        <div className={styles.field}><dt>Emergency contact mobile</dt><dd>{application.emergency_contact_phone ?? "Not provided"}</dd></div>
        <div className={`${styles.field} ${styles.wide}`}><dt>Services</dt><dd>{serviceLabels.length ? <ul className={styles.services}>{serviceLabels.map((label: string) => <li key={label}>{label}</li>)}</ul> : "None"}</dd></div>
        <div className={styles.field}><dt>Document consent recorded</dt><dd>{application.document_consent_at ? new Date(application.document_consent_at).toLocaleString() : "No"}</dd></div>
        <div className={styles.field}><dt>Review status</dt><dd>{application.status}</dd></div>
      </dl>
    </section>

    <section className={styles.card} aria-labelledby="verification-documents-title">
      <h2 id="verification-documents-title" className={styles.sectionTitle}>Verification documents</h2>
      {(docs ?? []).length ? <ul className={styles.documents}>{(docs ?? []).map((doc) => <li key={doc.id}><DocumentPreview applicantId={applicantId} kind={doc.kind} /></li>)}</ul> : <p>No documents were uploaded.</p>}
    </section>

    <section className={styles.card} aria-labelledby="claims-title">
      <h2 id="claims-title" className={styles.sectionTitle}>Skills proof, per service</h2>
      {claims.length ? <ul className={styles.documents}>{claims.map((c) => <li key={c.serviceId}>
        <strong>{c.label}</strong> ({c.status})
        <ul>{Array.from({ length: c.proofCount }, (_, i) => <li key={i}><DocumentPreview applicantId={applicantId} kind={`claim-${c.serviceId}-${i}`} label={`proof ${i + 1} for ${c.label}`} /></li>)}</ul>
        {c.proofCount === 0 && <span>No proof was uploaded.</span>}
      </li>)}</ul> : <p>No services were claimed.</p>}
      {application.interview_notes && <p>Interview or trial notes: {application.interview_notes}</p>}
    </section>

    <section className={styles.card} aria-labelledby="decision-title">
      {application.status === "pending" ? <ProviderDecisionForm applicantId={applicantId} claims={claims.map((c) => ({ serviceId: c.serviceId, label: c.label, proofCount: c.proofCount }))} interviewRequired={interviewRequired} /> : <>
        <h2 id="decision-title" className={styles.sectionTitle}>Decision</h2>
        <p>Decision recorded {application.reviewed_at ? new Date(application.reviewed_at).toLocaleString() : ""}.</p>
        <p>{application.rejection_reason ?? "No message was added."}</p>
      </>}
    </section>
  </section>;
}

function getPointCoordinates(value: unknown): { latitude: number; longitude: number } | null {
  if (value && typeof value === "object" && "coordinates" in value) {
    const coordinates = (value as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coordinates) && Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1])) {
      return { longitude: Number(coordinates[0]), latitude: Number(coordinates[1]) };
    }
  }
  if (typeof value === "string") {
    const match = value.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
    if (match) return { longitude: Number(match[1]), latitude: Number(match[2]) };
    const hex = value.match(/^(?:\\x)?([0-9a-f]+)$/i)?.[1];
    if (hex && hex.length >= 42 && hex.length % 2 === 0) {
      try {
        const bytes = Uint8Array.from(hex.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)));
        const view = new DataView(bytes.buffer);
        const littleEndian = bytes[0] === 1;
        const type = view.getUint32(1, littleEndian);
        let offset = 5;
        if ((type & 0x20000000) !== 0) offset += 4;
        const longitude = view.getFloat64(offset, littleEndian);
        const latitude = view.getFloat64(offset + 8, littleEndian);
        if (Number.isFinite(longitude) && Number.isFinite(latitude)) return { longitude, latitude };
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function getAddressFromCoordinates(point: { latitude: number; longitude: number } | null): Promise<string | null> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!point || !apiKey) return null;
  const url = new URL("https://api.geoapify.com/v1/geocode/reverse");
  url.searchParams.set("lat", String(point.latitude));
  url.searchParams.set("lon", String(point.longitude));
  url.searchParams.set("format", "json");
  url.searchParams.set("apiKey", apiKey);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json() as { results?: Array<{ country_code?: string; formatted?: string }> };
    return payload.results?.find((result) => result.country_code?.toLowerCase() === "ph")?.formatted ?? null;
  } catch {
    return null;
  }
}
