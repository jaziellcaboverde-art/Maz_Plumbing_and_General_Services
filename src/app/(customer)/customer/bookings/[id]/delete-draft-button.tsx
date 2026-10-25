"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/browser";

/** Deletes a draft the customer no longer wants. Only drafts can be deleted (RLS). Photos go first. */
export function DeleteDraftButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: files } = await supabase.storage.from("booking-photos").list(bookingId);
      if (files?.length) await supabase.storage.from("booking-photos").remove(files.map((file) => `${bookingId}/${file.name}`));
      const { error: deleteError } = await supabase.from("bookings").delete().eq("id", bookingId);
      if (deleteError) throw deleteError;
      router.replace("/customer/bookings");
      router.refresh();
    } catch {
      setError("Could not delete the draft. Try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => { setError(null); setOpen(true); }}>Delete this draft</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this draft?"
        error={error ?? undefined}
        footer={
          <ButtonGroup>
            <Button type="button" variant="primary" loading={busy} disabled={busy} onClick={remove}>Delete draft</Button>
            <Button type="button" disabled={busy} onClick={() => setOpen(false)}>Keep it</Button>
          </ButtonGroup>
        }
      >
        <p>The draft and its photos will be removed. This cannot be undone.</p>
      </Modal>
    </>
  );
}
