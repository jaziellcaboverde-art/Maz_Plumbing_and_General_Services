import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ProviderScheduleDirectory, type DirectoryBooking, type DirectoryProvider, type DirectoryService } from "./provider-schedule-directory";
import styles from "./page.module.css";

export default async function ProviderSchedulesPage() {
  await connection();
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") redirect("/customer");

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todayStart = new Date(`${today}T00:00:00+08:00`).toISOString();

  const admin = createAdminClient();
  const [{ data: providerRows, error: providerError }, { data: serviceRows, error: serviceError }, { data: bookingRows, error: bookingError }] = await Promise.all([
    admin.from("provider_profiles")
      .select("profile_id,profiles!provider_profiles_profile_id_fkey(first_name,last_name)")
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .limit(500),
    admin.from("provider_service_claims")
      .select("provider_id,service:services!provider_service_claims_service_id_fkey(id,category,name)")
      .eq("status", "approved")
      .limit(2000),
    admin.from("bookings")
      .select("id,provider_id,picked_provider_id,service_id,preferred_start,scheduled_start,status,description,is_urgent,services:services!bookings_service_id_fkey(name),customer:profiles!bookings_customer_id_fkey(first_name,last_name),address:addresses!bookings_address_id_fkey(barangay,city)")
      .not("status", "in", "(draft,cancelled,completed)")
      .or(`scheduled_start.gte.${todayStart},preferred_start.gte.${todayStart},status.eq.in_progress`)
      .order("scheduled_start", { ascending: true, nullsFirst: false })
      .order("preferred_start", { ascending: true, nullsFirst: false })
      .limit(1000),
  ]);

  const directoryProviders: DirectoryProvider[] = (providerRows ?? []).map((row) => {
    const profile = one(row.profiles);
    return {
      id: row.profile_id,
      name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Provider",
      services: [],
      bookings: [],
    };
  });
  const providersById = new Map(directoryProviders.map((provider) => [provider.id, provider]));
  const servicesById = new Map<string, DirectoryService>();
  for (const row of serviceRows ?? []) {
    const service = one(row.service);
    if (!service) continue;
    const entry = { id: service.id, name: service.name, category: service.category };
    servicesById.set(service.id, entry);
    providersById.get(row.provider_id)?.services.push(entry);
  }

  for (const row of bookingRows ?? []) {
    const startsAt = row.scheduled_start ?? row.preferred_start;
    if (!startsAt && row.status !== "in_progress") continue;
    const assignedProviderId = row.provider_id ?? row.picked_provider_id;
    const provider = assignedProviderId ? providersById.get(assignedProviderId) : null;
    const customer = one(row.customer);
    const service = one(row.services);
    const address = one(row.address);
    const booking: DirectoryBooking = {
      id: row.id,
      startsAt,
      customer: [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer",
      service: service?.name || "Service project",
      area: [address?.barangay, address?.city].filter(Boolean).join(", ") || "Service area not listed",
      description: row.description,
      urgent: row.is_urgent,
      status: row.status,
    };
    if (provider) provider.bookings.push(booking);
  }

  return <section className={styles.page}>
    {(providerError || serviceError || bookingError) && <p role="alert">Could not load the full schedule: {(providerError ?? serviceError ?? bookingError)?.message}</p>}
    <ProviderScheduleDirectory providers={directoryProviders} services={[...servicesById.values()]} />
  </section>;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
