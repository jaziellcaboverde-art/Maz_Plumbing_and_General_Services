import "server-only";

import { deliverNotifications } from "@/lib/matching/engine";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;
type Expired = { quote_id: string; booking_id: string; provider_id: string; customer_id: string };

/** Close approved quotes the customer did not answer in time (step 9.5). Returns how many closed. */
export async function processExpiredQuotes(bookingId?: string, admin: Admin = createAdminClient()): Promise<number> {
  const { data, error } = await admin.rpc("expire_stale_quotes", { p_booking_id: bookingId ?? null });
  if (error) throw new Error("Could not close expired quotes.");
  const rows = (Array.isArray(data) ? data : []) as Expired[];
  for (const row of rows) {
    await deliverNotifications([
      {
        profile_id: row.customer_id, event: "quote.expired_customer", title: "Your quote ran out of time",
        body: "The quote was not answered in time. Your provider can send a new one.",
        link: `/customer/bookings/${row.booking_id}`, channels: ["in_app", "email"],
      },
      {
        profile_id: row.provider_id, event: "quote.expired_provider", title: "A quote ran out of time",
        body: "The customer did not answer. Send a new quote if the job is still on.",
        link: `/provider/jobs/${row.booking_id}`, channels: ["in_app"],
      },
    ]);
  }
  return rows.length;
}
