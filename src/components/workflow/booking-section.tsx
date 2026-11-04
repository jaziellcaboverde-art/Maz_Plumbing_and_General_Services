"use client";

import { useState, type ReactNode } from "react";
import { Modal, useInsideModal } from "@/components/ui/modal";
import { useInlineSection } from "./booking-workspace";
import moduleStyles from "./workspace-modules.module.css";
import {
  Banknote,
  ArrowUpRight,
  CalendarDays,
  ClipboardCheck,
  FileText,
  History,
  Image,
  MessageSquare,
  Star,
  Users,
  Wrench,
  Palette,
  KeyRound,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import styles from "./workflow.module.css";

const SECTION_ICONS: Record<string, LucideIcon> = {
  "Display preferences": Palette,
  "Change password": KeyRound,
  "Payout details": Banknote,
  "Saved addresses": MapPin,
  "Weekly working hours": CalendarDays,
  "Set availability exception": CalendarDays,
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
  open: initiallyOpen,
  children,
  presentation = "launcher",
  description,
  actionLabel,
}: {
  title: string;
  open?: boolean;
  children: ReactNode;
  presentation?: "launcher" | "card" | "plain";
  description?: string;
  actionLabel?: string;
}) {
  const Icon = SECTION_ICONS[title] ?? FileText;
  const inline = useInlineSection();
  const insideModal = useInsideModal();
  const [show, setShow] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  // Existing workflow hints remain accepted; modules now open on explicit action.
  void initiallyOpen;
  if (inline && presentation === "plain") return <>{children}</>;
  if (inline)
    return (
      <section className={styles.card}>
        <div className={moduleStyles.sectionHeading}>
          <Icon className={styles.sectionIcon} aria-hidden="true" />
          <h2>{title}</h2>
        </div>
        <div className={styles.sectionBody}>{children}</div>
      </section>
    );
  return (
    <div
      className={presentation === "card" ? moduleStyles.moduleCard : undefined}
    >
      {presentation === "card" && (
        <>
          <Icon className={moduleStyles.cardIcon} aria-hidden="true" />
          <h2>{title}</h2>
          <p>
            {description ??
              (title === "Weekly working hours"
                ? "Set the days and times you normally work."
                : "Add dates when your usual availability changes.")}
          </p>
        </>
      )}
      <button
        type="button"
        className={
          presentation === "card"
            ? moduleStyles.cardAction
            : moduleStyles.launcher
        }
        onClick={() => {
          setHasOpened(true);
          setShow(true);
        }}
        aria-haspopup={insideModal ? undefined : "dialog"}
      >
        {presentation !== "card" && (
          <Icon className={styles.sectionIcon} aria-hidden="true" />
        )}
        <span>
          {actionLabel ??
            (presentation === "card"
              ? title === "Weekly working hours"
                ? "Edit working hours"
                : "Add exception"
              : title)}
        </span>
        <ArrowUpRight aria-hidden="true" />
      </button>
      {hasOpened && (
        <Modal open={show} onClose={() => setShow(false)} title={title}>
          <div className={styles.sectionBody}>{children}</div>
        </Modal>
      )}
    </div>
  );
}
