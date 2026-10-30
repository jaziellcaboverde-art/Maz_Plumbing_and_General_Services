import { officialStatus, type OfficialStatus } from "@/lib/booking/official-status";
import type { BookingStatus } from "@/lib/booking/rules";
import styles from "./status-badge.module.css";

/** One of the six official statuses as a colored badge. Pass either the database status or the official one. */
export function StatusBadge({ status }: { status: BookingStatus | OfficialStatus }) {
  const official = (status === "Pending" || status === "Accepted" || status === "Assigned" || status === "Ongoing" || status === "Completed" || status === "Cancelled")
    ? status
    : officialStatus(status as BookingStatus);
  if (!official) return null;
  return <span className={styles.badge} data-status={official}>{official}</span>;
}
