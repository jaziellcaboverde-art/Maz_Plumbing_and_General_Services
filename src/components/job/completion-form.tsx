"use client";
import { WorkUpdateForm } from "@/components/provider/work-update-form";
/** Compatibility entry point using the same owned uploads and MAZ review as provider updates. */
export function CompletionForm({ bookingId }: { bookingId: string }) {
  return (
    <WorkUpdateForm
      bookingId={bookingId}
      inProgress
      milestones={[]}
      initialKind="completion"
    />
  );
}
