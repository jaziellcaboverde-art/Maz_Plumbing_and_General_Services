"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { postJson } from "@/lib/matching/client";

/** Starts matching for urgent and large jobs the first time the booking page opens, then refreshes. */
export function MatchingKick({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void postJson(`/api/bookings/${bookingId}/start-matching`, {}).then(() => router.refresh());
  }, [bookingId, router]);
  return null;
}
