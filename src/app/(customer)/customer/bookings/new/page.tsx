import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/layout/page-heading";
import { valuesFromDraft, type DraftRow } from "@/lib/booking/rules";
import { createClient } from "@/lib/supabase/server";
import { BookingForm, type AddressOption, type ServiceOption } from "./booking-form";

export default function NewBookingPage({ searchParams }: { searchParams: Promise<{ draft?: string; service?: string }> }) {
  return <Suspense fallback={<p role="status">Loading the booking form…</p>}><NewBookingContent searchParams={searchParams} /></Suspense>;
}

async function NewBookingContent({ searchParams }: { searchParams: Promise<{ draft?: string; service?: string }> }) {
  const { draft, service } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/customer/bookings/new");

  const [{ data: services }, { data: addressRows }] = await Promise.all([
    supabase.from("services").select("id,category,name,default_class,urgent_allowed,description")
      .eq("active", true).order("sort_order").order("name"),
    supabase.from("addresses").select("id,label,line1,barangay,city,location").eq("profile_id", user.id).order("created_at"),
  ]);

  let draftId: string | null = null;
  let draftRow: DraftRow | null = null;
  if (draft && /^[0-9a-f-]{36}$/i.test(draft)) {
    const { data } = await supabase.from("bookings")
      .select("id,status,service_id,description,address_id,preferred_start,is_urgent,is_major_renovation,terms_accepted_at")
      .eq("id", draft).eq("customer_id", user.id).maybeSingle();
    // Only a draft can be edited. A submitted booking opens its detail page instead.
    if (data && data.status !== "draft") redirect(`/customer/bookings/${data.id}`);
    if (data) { draftId = data.id; draftRow = data; }
  }

  let photos: string[] = [];
  if (draftId) {
    const { data } = await supabase.storage.from("booking-photos").list(draftId);
    photos = (data ?? []).filter((file) => file.name && !file.name.startsWith(".")).map((file) => file.name);
  }

  const serviceOptions: ServiceOption[] = (services ?? []).map((s) => ({
    id: s.id, category: s.category, name: s.name, defaultClass: s.default_class,
    urgentAllowed: s.urgent_allowed, description: s.description ?? "",
  }));
  const initialValues = valuesFromDraft(draftRow);
  const selectedService = serviceOptions.find((option) => option.id === service);
  if (!draftRow && selectedService) initialValues.serviceId = selectedService.id;
  const addressOptions: AddressOption[] = (addressRows ?? []).map((a) => ({
    id: a.id,
    label: [a.label, a.line1, a.barangay, a.city].filter(Boolean).join(", "),
    hasPin: Boolean(a.location),
  }));

  return (
    <section>
      <PageHeading title="Book a service" description="Tell us what you need. Your answers are saved as a draft, so you can leave and come back." />
      <BookingForm
        customerId={user.id}
        services={serviceOptions}
        addresses={addressOptions}
        initialDraftId={draftId}
        initialValues={initialValues}
        initialPhotos={photos}
      />
    </section>
  );
}
