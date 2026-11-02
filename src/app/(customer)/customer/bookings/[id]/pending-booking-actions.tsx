"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/booking/rules";
import { createClient } from "@/lib/supabase/browser";

/**
 * Reschedule and Cancel for a Pending booking (spec 3.I and 6.2). The server repeats the rule: the
 * reschedule_booking function and the status move table both refuse once the booking is past Pending.
 * Cancel always asks for confirmation and a reason (spec section 7).
 */
export function PendingBookingActions({ bookingId, preferredStart, isUrgent }: { bookingId: string; preferredStart: string | null; isUrgent: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<"reschedule" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [when, setWhen] = useState(toLocalInputValue(preferredStart));
  const [reason, setReason] = useState("");

  // Earliest choice is now, in the browser's time zone, as a datetime-local value.
  const minLocal = toLocalInputValue(new Date().toISOString());

  function close() {
    if (busy) return;
    setDialog(null);
    setError(null);
  }

  async function reschedule() {
    const iso = fromLocalInputValue(when);
    if (!iso || new Date(iso) <= new Date()) {
      setError("Choose a date and time in the future.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("reschedule_booking", { p_booking_id: bookingId, p_preferred_start: iso });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message || "Could not reschedule. Try again.");
      return;
    }
    setDialog(null);
    toast.show({ status: "success", message: "Booking rescheduled" });
    router.refresh();
  }

  async function cancel() {
    if (reason.trim().length < 3) {
      setError("Tell us why you are cancelling, in a few words.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("change_booking_status", { p_booking_id: bookingId, p_to: "cancelled", p_reason: reason.trim() });
    setBusy(false);
    if (rpcError) {
      setError("Could not cancel this booking. It may have just been accepted. Refresh the page, or message support.");
      return;
    }
    setDialog(null);
    toast.show({ status: "success", message: "Booking cancelled" });
    router.refresh();
  }

  return (
    <>
      <ButtonGroup>
        {!isUrgent && <Button type="button" onClick={() => { setError(null); setDialog("reschedule"); }}>Reschedule</Button>}
        <Button type="button" onClick={() => { setError(null); setDialog("cancel"); }}>Cancel booking</Button>
      </ButtonGroup>

      <Modal
        open={dialog === "reschedule"}
        onClose={close}
        title="Reschedule this booking"
        error={error ?? undefined}
        footer={<ButtonGroup>
          <Button type="button" variant="primary" loading={busy} disabled={busy} onClick={reschedule}>Save new schedule</Button>
          <Button type="button" disabled={busy} onClick={close}>Keep current schedule</Button>
        </ButtonGroup>}
      >
        <Input label="New date and time" type="datetime-local" min={minLocal} value={when} onChange={(event) => setWhen(event.target.value)} required />
      </Modal>

      <Modal
        open={dialog === "cancel"}
        onClose={close}
        title="Cancel this booking?"
        error={error ?? undefined}
        footer={<ButtonGroup>
          <Button type="button" variant="primary" loading={busy} disabled={busy} onClick={cancel}>Yes, cancel booking</Button>
          <Button type="button" disabled={busy} onClick={close}>Keep booking</Button>
        </ButtonGroup>}
      >
        <p>You can cancel on your own only while the booking is Pending. This cannot be undone.</p>
        <Textarea label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} required />
      </Modal>
    </>
  );
}
