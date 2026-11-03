import type { ReactNode } from "react";
import {
  Banknote,
  CalendarDays,
  ClipboardCheck,
  FileText,
  History,
  Image,
  MessageSquare,
  Star,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import styles from "./workflow.module.css";

const SECTION_ICONS: Record<string, LucideIcon> = {
  "Team & schedule": CalendarDays,
  "Quote & approval": FileText,
  "Payments & requests": Banknote,
  "Work & completion": ClipboardCheck,
  "Activity history": History,
  "Share project photos (optional)": Image,
  "Review request": ClipboardCheck,
  "Team and appointment": CalendarDays,
  "Assignments and date agreements": Users,
  "Assigned team": Users,
  "Your project roles": Users,
  "Verify manual payments": Banknote,
  "Pay MAZ": Banknote,
  "Customer requests and refunds": MessageSquare,
  "Requests and support": MessageSquare,
  "Milestones and provider evidence": ClipboardCheck,
  "Project milestones": ClipboardCheck,
  "Project control": Wrench,
  "Project publication": Image,
  "Separate project-photo permission": Image,
  "Your MAZ company review": Star,
  "Booking audit": History,
  "Your submissions and MAZ decisions": History,
};

export function BookingSection({
  title,
  open = false,
  children,
}: {
  title: string;
  open?: boolean;
  children: ReactNode;
}) {
  const Icon = SECTION_ICONS[title] ?? FileText;
  return (
    <details className={styles.disclosure} open={open}>
      <summary>
        <Icon className={styles.sectionIcon} aria-hidden="true" />
        <h2>{title}</h2>
      </summary>
      <div className={styles.sectionBody}>{children}</div>
    </details>
  );
}
