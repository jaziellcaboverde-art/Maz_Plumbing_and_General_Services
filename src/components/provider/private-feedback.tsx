import { createClient } from "@/lib/supabase/server";
import { PrivateFeedbackForm } from "./private-feedback-form";
export async function PrivateProviderFeedback({
  bookingId,
}: {
  bookingId: string;
}) {
  const client = await createClient();
  const { data, error } = await client.rpc("booking_feedback_workers", {
    p_booking: bookingId,
  });
  if (error)
    return <p role="alert">Private worker feedback could not be loaded.</p>;
  if (!data?.length) return null;
  return <PrivateFeedbackForm bookingId={bookingId} workers={data} />;
}
