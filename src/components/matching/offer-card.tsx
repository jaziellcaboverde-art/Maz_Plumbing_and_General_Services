"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { kmAway, dayAndTime } from "@/lib/matching/format";
import { postJson } from "@/lib/matching/client";
import styles from "./matching.module.css";

export type OfferView = {
  offerId: string;
  kind: string;
  serviceName: string;
  description: string;
  isUrgent: boolean;
  preferredStart: string | null;
  area: string;
  distanceM: number | null;
  expiresAt: string;
  isForeman: boolean;
  responseUrl?: string;
  role?: string;
  endsAt?: string;
};

/** A pending offer on the provider's Offers screen. Accept or decline, with an optional reason. */
export function OfferCard({ offer }: { offer: OfferView }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function answer(accept: boolean) {
    if (busy) return;
    setBusy(accept ? "accept" : "decline");
    setError(null);
    const message = await postJson(
      offer.responseUrl ?? `/api/offers/${offer.offerId}/respond`,
      { accept, reason: accept ? null : reason },
    );
    if (message) {
      setError(message);
      setBusy(null);
      router.refresh();
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <li className={styles.card}>
      <div className={styles.head}>
        <span className={styles.name}>{offer.serviceName}</span>
        {offer.isUrgent && <span className={styles.urgent}>Urgent</span>}
        {offer.isForeman && <span className={styles.tag}>Foreman</span>}
        {offer.role && <span className={styles.tag}>{offer.role}</span>}
      </div>
      <p>{offer.description}</p>
      <div className={styles.facts}>
        <span>
          {offer.area}
          {offer.distanceM !== null ? `, ${kmAway(offer.distanceM)}` : ""}
        </span>
        <span>
          {offer.preferredStart
            ? dayAndTime(offer.preferredStart)
            : "Ask MAZ to confirm the appointment"}
          {offer.endsAt ? ` to ${dayAndTime(offer.endsAt)}` : ""}
        </span>
        <span>Answer by {dayAndTime(offer.expiresAt)} (Philippine time)</span>
        <span>
          Accepting confirms your availability. MAZ confirms the appointment and
          team.
        </span>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        <Button
          type="button"
          variant="primary"
          loading={busy === "accept"}
          disabled={busy !== null}
          onClick={() => answer(true)}
        >
          Accept
        </Button>
        <Button
          type="button"
          disabled={busy !== null}
          onClick={() => setOpen(true)}
        >
          Decline
        </Button>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Decline this job?"
        error={error ?? undefined}
        footer={
          <ButtonGroup>
            <Button
              type="button"
              variant="primary"
              loading={busy === "decline"}
              disabled={busy !== null}
              onClick={() => answer(false)}
            >
              Decline job
            </Button>
            <Button
              type="button"
              disabled={busy !== null}
              onClick={() => setOpen(false)}
            >
              Go back
            </Button>
          </ButtonGroup>
        }
      >
        <Textarea
          label="Reason (optional)"
          value={reason}
          maxLength={300}
          onChange={(event) => setReason(event.target.value)}
        />
      </Modal>
    </li>
  );
}
