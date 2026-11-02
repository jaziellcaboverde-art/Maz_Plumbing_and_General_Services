/**
 * The six official booking statuses from "Kumpuninja - System Process, Rules, at UI Specification", Section 2.
 * Customers only ever see these six names. The database keeps its finer steps (see BookingStatus in rules.ts)
 * and this file is the one place that maps them, so a screen never invents its own status name.
 */
import type { BookingStatus } from "./rules";

export const OFFICIAL_STATUSES = ["Pending", "Accepted", "Assigned", "Ongoing", "Completed", "Cancelled"] as const;
export type OfficialStatus = (typeof OFFICIAL_STATUSES)[number];

/** The steps of the timeline on Booking Detail. Cancelled is not a step, it ends the timeline. */
export const TIMELINE_STEPS = ["Pending", "Accepted", "Assigned", "Ongoing", "Completed"] as const satisfies readonly OfficialStatus[];

/**
 * Database status to official status.
 * - draft is not a booking yet (it was never submitted), so it has no official status.
 * - open and offered: submitted, waiting for the team and a provider.
 * - accepted: the provider accepted, which is "Assigned" in the spec. The spec's own "Accepted" (the admin
 *   accepts the request first) has no separate database step yet, so no booking reads "Accepted" today.
 * - quoted, deposit_paid, scheduled, on_the_way: a provider is assigned and the work has not started.
 * - in_progress: work started.
 * - done, signed, balance_paid, completed: the work is finished. Money is shown by the payment status instead.
 */
const MAP: Record<Exclude<BookingStatus, "draft">, OfficialStatus> = {
  open: "Pending",
  offered: "Pending",
  accepted: "Assigned",
  quoted: "Assigned",
  deposit_paid: "Assigned",
  scheduled: "Assigned",
  on_the_way: "Assigned",
  in_progress: "Ongoing",
  done: "Completed",
  signed: "Completed",
  balance_paid: "Completed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function officialStatus(status: BookingStatus): OfficialStatus | null {
  return status === "draft" ? null : MAP[status];
}

/** Position on the timeline, or -1 for Cancelled and drafts. */
export function timelineIndex(status: OfficialStatus | null): number {
  return status ? (TIMELINE_STEPS as readonly string[]).indexOf(status) : -1;
}

/** The customer may reschedule or cancel on their own only while the booking is Pending (spec 3.I). */
export function customerCanChange(status: BookingStatus): boolean {
  return officialStatus(status) === "Pending";
}

/** Filter value in the URL for each official status. */
export function statusSlug(status: OfficialStatus): string {
  return status.toLowerCase();
}

export function statusFromSlug(value: string | null | undefined): OfficialStatus | null {
  return OFFICIAL_STATUSES.find((status) => statusSlug(status) === value) ?? null;
}

/** Database statuses behind an official status, for filtering a query. */
export function databaseStatusesFor(status: OfficialStatus): BookingStatus[] {
  return (Object.entries(MAP) as [BookingStatus, OfficialStatus][]).filter(([, official]) => official === status).map(([db]) => db);
}

/** Payment status of a booking (spec 3.G): Unpaid, Partially Paid, Paid. */
export type PaymentStatus = "Unpaid" | "Partially Paid" | "Paid";

export function paymentStatusFor(input: { status: BookingStatus; quoteTotal: number | null; paidTotal: number }): PaymentStatus | null {
  if (input.status === "draft" || input.status === "cancelled") return null;
  if (input.status === "balance_paid" || input.status === "completed") return "Paid";
  if (input.quoteTotal !== null && input.quoteTotal > 0 && input.paidTotal >= input.quoteTotal) return "Paid";
  return input.paidTotal > 0 ? "Partially Paid" : "Unpaid";
}
