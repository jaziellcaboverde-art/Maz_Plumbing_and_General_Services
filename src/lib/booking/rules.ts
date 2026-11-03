/**
 * Booking request rules (Phase 6). Pure, so the stepper and the tests share them.
 * submit_booking in migration 20261025120000 repeats every rule on the server.
 */

export type BookingStatus =
  | "draft"
  | "open"
  | "offered"
  | "accepted"
  | "quoted"
  | "deposit_paid"
  | "scheduled"
  | "on_the_way"
  | "in_progress"
  | "done"
  | "signed"
  | "balance_paid"
  | "completed"
  | "cancelled";

export const STATUS_LABELS: Record<BookingStatus, string> = {
  draft: "Draft",
  open: "Waiting for a provider",
  offered: "Offered to a provider",
  accepted: "Accepted",
  quoted: "Quote ready",
  deposit_paid: "Deposit paid",
  scheduled: "Scheduled",
  on_the_way: "Provider on the way",
  in_progress: "In progress",
  done: "Work done",
  signed: "Signed",
  balance_paid: "Balance paid",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type DraftValues = {
  serviceId: string;
  description: string;
  addressId: string;
  isUrgent: boolean;
  isMajorRenovation: boolean;
  /** Local date and time as a datetime-local value, "2026-11-02T09:00". Empty when not chosen. */
  preferredStartLocal: string;
  termsAccepted: boolean;
  preferredWorkerNote?: string;
  alternateStartLocal?: string;
};

export type ServiceRule = {
  id: string;
  defaultClass: "minor" | "major";
  urgentAllowed: boolean;
};
export type AddressRule = { id: string; hasPin: boolean };

export const MIN_DESCRIPTION_LENGTH = 10;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** The exact list of what is still missing. It is shown next to the disabled submit button (step 6.9). */
export function missingForSubmit(
  values: DraftValues,
  services: readonly ServiceRule[],
  addresses: readonly AddressRule[],
  now: Date = new Date(),
): string[] {
  const missing: string[] = [];
  const service = services.find((item) => item.id === values.serviceId);
  if (!service) missing.push("Choose a service");
  if (values.description.trim().length < MIN_DESCRIPTION_LENGTH) {
    missing.push(
      `Describe the job in at least ${MIN_DESCRIPTION_LENGTH} characters`,
    );
  }
  const address = addresses.find((item) => item.id === values.addressId);
  if (!address) missing.push("Choose a service address");
  else if (!address.hasPin)
    missing.push("Add a map pin to your service address");
  if (values.isUrgent) {
    if (service && !service.urgentAllowed)
      missing.push("Urgent requests are not available for this service");
  } else {
    const iso = fromLocalInputValue(values.preferredStartLocal);
    const start = iso ? new Date(iso) : null;
    if (!start || Number.isNaN(start.valueOf()))
      missing.push("Choose a date and time, or switch on urgent");
    else if (start <= now) missing.push("Choose a date and time in the future");
  }
  if (!values.termsAccepted) missing.push("Read and accept the Terms");
  return missing;
}

/** Major when the customer ticked major renovation or the service is major by default (step 6.5). */
export function jobClassFor(
  service: Pick<ServiceRule, "defaultClass">,
  isMajorRenovation: boolean,
): "minor" | "major" {
  return isMajorRenovation || service.defaultClass === "major"
    ? "major"
    : "minor";
}

/** Calendar inputs consistently display Philippine time, regardless of device timezone. */
export function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return "";
  return new Date(date.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}

/** A datetime-local value to the ISO time saved in the database. */
export function fromLocalInputValue(local: string): string | null {
  if (!local) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const date = new Date(`${local}:00+08:00`);
  return Number.isNaN(date.valueOf()) ||
    toLocalInputValue(date.toISOString()) !== local
    ? null
    : date.toISOString();
}

export type DraftRow = {
  service_id: string | null;
  description: string | null;
  address_id: string | null;
  preferred_start: string | null;
  is_urgent: boolean;
  is_major_renovation: boolean;
  terms_accepted_at: string | null;
  preferred_worker_note?: string | null;
  alternate_start?: string | null;
};

/** Turn a saved draft row back into form values, so a draft can be resumed (step 6.8). */
export function valuesFromDraft(row: DraftRow | null): DraftValues {
  return {
    serviceId: row?.service_id ?? "",
    description: row?.description ?? "",
    addressId: row?.address_id ?? "",
    isUrgent: row?.is_urgent ?? false,
    isMajorRenovation: row?.is_major_renovation ?? false,
    preferredStartLocal: toLocalInputValue(row?.preferred_start),
    // Accepting the Terms is asked again at the final step of every submission.
    termsAccepted: false,
    ...(row?.preferred_worker_note
      ? { preferredWorkerNote: row.preferred_worker_note }
      : {}),
    ...(row?.alternate_start
      ? { alternateStartLocal: toLocalInputValue(row.alternate_start) }
      : {}),
  };
}

/** The columns a customer may write to a draft (see the grant in the RLS migration). */
export function draftColumns(values: DraftValues) {
  return {
    service_id: values.serviceId || null,
    description: values.description.trim() ? values.description : null,
    address_id: values.addressId || null,
    is_urgent: values.isUrgent,
    is_major_renovation: values.isMajorRenovation,
    preferred_start: values.isUrgent
      ? null
      : fromLocalInputValue(values.preferredStartLocal),
    ...(values.preferredWorkerNote !== undefined
      ? {
          preferred_worker_note:
            values.preferredWorkerNote.trim().slice(0, 120) || null,
        }
      : {}),
    ...(values.alternateStartLocal !== undefined
      ? { alternate_start: fromLocalInputValue(values.alternateStartLocal) }
      : {}),
  };
}
