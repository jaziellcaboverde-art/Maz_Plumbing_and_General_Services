import "server-only";
import { createClient } from "@/lib/supabase/server";
export type ManagedBooking = {
  id: string;
  status: string;
  official_status:
    "Pending" | "Accepted" | "Assigned" | "Ongoing" | "Completed" | "Cancelled";
  description: string | null;
  customer_id: string;
  service_id: string | null;
  manual_customer_name: string | null;
  manual_customer_mobile: string | null;
  manual_customer_address: string | null;
  provider_id: string | null;
  preferred_start: string | null;
  alternate_start: string | null;
  preferred_worker_note: string | null;
  scheduled_start: string | null;
  admin_accepted_at: string | null;
  admin_review_note: string | null;
  inspection_required: boolean;
  inspection_fee: number;
  inspection_pay_before_visit: boolean;
  contract_required: boolean;
  quote_total: number | null;
  gateway_fee: number;
  created_at: string;
  cancel_reason: string | null;
  services: { name: string; category: string } | null;
  addresses: { line1: string; barangay: string | null; city: string } | null;
};
export type WorkflowQuote = {
  id: string;
  version: number;
  status: string;
  amount: number;
  deposit_amount: number | null;
  notes: string | null;
  expires_at: string | null;
  line_items: { description: string; quantity: number; unitPrice: number }[];
  payment_schedule: {
    label: string;
    amount: number;
    dueAt: string | null;
    milestoneId: string | null;
  }[];
  accepted_at: string | null;
  decision_note?: string | null;
  decision_channel?: string | null;
};
export type ProjectDocument = {
  id: string;
  kind: string;
  version: number;
  title: string;
  body: string;
  cost_delta: number;
  days_delta: number;
  status: string;
  decided_at: string | null;
  decision_note?: string | null;
  decision_channel?: string | null;
};
export type WorkflowSummary = {
  net_paid: number;
  inspection_due: number;
  deposit_due: number;
  milestone_due: number;
  balance_due: number;
  team: {
    provider_id: string;
    name: string;
    trade: string;
    phase: string;
    status: string;
    starts_at: string;
    ends_at: string;
  }[];
};
export async function loadManagedBooking(
  client: Awaited<ReturnType<typeof createClient>>,
  id: string,
) {
  const results = await Promise.all([
    client
      .from("bookings")
      .select("*,services(name,category),addresses(line1,barangay,city)")
      .eq("id", id)
      .maybeSingle(),
    client.rpc("managed_booking_summary", { p_booking: id }),
    client
      .from("quotes")
      .select("*")
      .eq("booking_id", id)
      .order("version", { ascending: false }),
    client
      .from("project_documents")
      .select("*")
      .eq("booking_id", id)
      .order("created_at", { ascending: false }),
    client
      .from("payments")
      .select("*")
      .eq("booking_id", id)
      .order("created_at", { ascending: false }),
    client
      .from("manual_payment_claims")
      .select("*")
      .eq("booking_id", id)
      .order("created_at", { ascending: false }),
    client
      .from("booking_requests")
      .select("*")
      .eq("booking_id", id)
      .order("created_at", { ascending: false }),
    client
      .from("milestones")
      .select("*")
      .eq("booking_id", id)
      .order("position"),
    client
      .from("company_reviews")
      .select("*")
      .eq("booking_id", id)
      .maybeSingle(),
    client
      .from("project_publication_consents")
      .select("photos_allowed")
      .eq("booking_id", id)
      .maybeSingle(),
    client
      .from("receipts")
      .select("number,amount,issued_at,kind")
      .eq("booking_id", id)
      .order("issued_at", { ascending: false }),
    client.from("maz_payment_instructions").select("method,instructions"),
  ]);
  const error = results.find((r) => r.error)?.error;
  return {
    error,
    booking: results[0].data as unknown as ManagedBooking | null,
    summary: results[1].data as unknown as WorkflowSummary | null,
    quotes: (results[2].data ?? []) as unknown as WorkflowQuote[],
    documents: (results[3].data ?? []) as unknown as ProjectDocument[],
    payments: results[4].data ?? [],
    claims: results[5].data ?? [],
    requests: results[6].data ?? [],
    milestones: results[7].data ?? [],
    review: results[8].data,
    consent: results[9].data,
    receipts: results[10].data ?? [],
    instructions: results[11].data ?? [],
  };
}
