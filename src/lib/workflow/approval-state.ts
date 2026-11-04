import type {
  ManagedBooking,
  ProjectDocument,
  WorkflowQuote,
  WorkflowSummary,
} from "./load";

export type ApprovalAssignment = {
  provider_id: string;
  trade: string;
  phase: string;
  status: string;
  required?: boolean;
};
export type ApprovalEvidence = {
  kind: string;
  review_status: string;
  provider_id: string;
};
export type NextBookingAction = {
  title: string;
  description: string;
  section?: string;
};

export function quotationStatus(status: string) {
  return (
    (
      {
        proposed: "Draft",
        approved: "Issued by MAZ",
        accepted: "Approved",
        declined: "Declined",
        superseded: "Superseded / Revised",
      } as Record<string, string>
    )[status] ?? status.replaceAll("_", " ")
  );
}

/** Presentation of actual stored approvals. It never writes or substitutes for database guards. */
export function bookingApprovalState({
  booking: b,
  summary,
  quotes,
  documents,
  assignments,
  evidence,
  milestones,
  pendingClaims = false,
  approvedProviderIds,
  legacyAccepted = [],
}: {
  booking: ManagedBooking;
  summary: WorkflowSummary;
  quotes: WorkflowQuote[];
  documents: ProjectDocument[];
  assignments: ApprovalAssignment[];
  evidence: ApprovalEvidence[];
  milestones: { status: string }[];
  pendingClaims?: boolean;
  approvedProviderIds?: Set<string>;
  legacyAccepted?: string[];
}) {
  const ordered = [...quotes].sort((a, z) => z.version - a.version);
  const accepted = ordered.find((q) => q.status === "accepted");
  const currentQuote =
    accepted ?? ordered.find((q) => q.status === "approved") ?? ordered[0];
  const contracts = documents.filter((d) => d.kind === "contract");
  const approvedContract = contracts.find((d) => d.status === "accepted");
  const pendingContract = contracts.find((d) => d.status === "issued");
  const contractState = approvedContract
    ? "Contract Approved"
    : !b.contract_required
      ? "Contract Not Required"
      : pendingContract
        ? "Awaiting Customer Contract Approval"
        : "Contract Required";
  const requiredBeforeWork = Number(accepted?.deposit_amount ?? 0);
  const requiredOutstanding = accepted
    ? Math.max(0, Number(summary.deposit_due))
    : 0;
  const paymentState = !requiredBeforeWork
    ? "No Upfront Payment Required"
    : !requiredOutstanding
      ? "Required Payment Verified"
      : pendingClaims
        ? "Pending Manual Verification"
        : "Awaiting Customer Payment";
  const currentDue = Math.max(
    0,
    Number(summary.inspection_due),
    Number(summary.deposit_due),
    Number(summary.milestone_due),
    Number(summary.balance_due),
  );
  const team = assignments.filter((a) => a.phase === "execution");
  const acceptedTeam = team.filter((a) => a.status === "accepted");
  const legacyLead =
    !!b.provider_id &&
    legacyAccepted.includes(b.provider_id) &&
    !team.some((a) => a.provider_id === b.provider_id);
  const unfilledRequired = team.some(
    (a) =>
      a.required &&
      !team.some(
        (filled) =>
          filled.trade === a.trade &&
          ["accepted", "completed"].includes(filled.status),
      ),
  );
  const startBlocks: string[] = [];
  if (!accepted)
    startBlocks.push("Issue the MAZ quotation before starting work.");
  if (b.contract_required && !approvedContract)
    startBlocks.push("Customer approval of the required contract is needed.");
  if (requiredOutstanding > 0)
    startBlocks.push("Verify the payment required before work.");
  if (!acceptedTeam.length && !legacyLead)
    startBlocks.push("Assign the execution workers before starting work.");
  if (
    team.some((a) => ["offered", "withdrawal_requested"].includes(a.status)) ||
    unfilledRequired
  )
    startBlocks.push(
      "Resolve pending or withdrawn assignments and required worker roles.",
    );
  if (
    approvedProviderIds &&
    acceptedTeam.some((a) => !approvedProviderIds.has(a.provider_id))
  )
    startBlocks.push(
      "Replace workers who are no longer approved for this service.",
    );
  if (!b.scheduled_start || !b.execution_confirmed_at)
    startBlocks.push(
      "Confirm the execution schedule and customer date agreement.",
    );
  const completionBlocks: string[] = [];
  if (
    !evidence.some(
      (u) =>
        u.kind === "completion" &&
        u.review_status === "approved" &&
        u.provider_id === b.provider_id,
    )
  )
    completionBlocks.push("Approve the lead worker's completion evidence.");
  if (
    team.some((a) =>
      ["offered", "accepted", "withdrawal_requested"].includes(a.status),
    ) ||
    team.some(
      (a) =>
        a.required &&
        !team.some(
          (filled) => filled.trade === a.trade && filled.status === "completed",
        ),
    )
  )
    completionBlocks.push(
      "Review all required worker completions or replacements.",
    );
  if (milestones.some((m) => m.status !== "confirmed"))
    completionBlocks.push("Approve the remaining work checkpoints.");
  let next: NextBookingAction;
  if (b.status === "cancelled")
    next = {
      title: "Booking cancelled",
      description: "Any refund requires its own review.",
      section: "Payments & requests",
    };
  else if (["balance_paid", "completed"].includes(b.status))
    next = {
      title: "Booking closed",
      description: "Completion, turnover and verified settlement are recorded.",
    };
  else if (b.status === "signed")
    next = {
      title:
        Number(summary.balance_due) > 0
          ? "Track Final Payment"
          : "Close Booking",
      description:
        "Customer turnover is recorded. Reconcile the verified balance before closure.",
      section:
        Number(summary.balance_due) > 0
          ? "Payments & requests"
          : "Work & completion",
    };
  else if (b.status === "done")
    next = {
      title: "Await Customer Turnover",
      description: "Work is approved. Payment status remains separate.",
      section: "Work & completion",
    };
  else if (b.status === "in_progress")
    next = {
      title: evidence.some(
        (u) => u.kind === "change_request" && u.review_status === "pending",
      )
        ? "Review Additional Work Request"
        : evidence.some((u) => u.review_status === "pending")
          ? "Review Work Evidence"
          : !completionBlocks.length
            ? "Ready for Completion Review"
            : "Execute Approved Work",
      description:
        "Extra work is optional and needs its own customer approval.",
      section: "Work & completion",
    };
  else if (!b.admin_accepted_at)
    next = {
      title: "Review Customer Request",
      description:
        "Decide whether an inspection or separate contract is needed.",
      section: "Review request",
    };
  else if (
    b.inspection_required &&
    !evidence.some(
      (u) => u.kind === "inspection" && u.review_status === "approved",
    )
  )
    next = {
      title:
        b.inspection_pay_before_visit && Number(summary.inspection_due) > 0
          ? "Verify Inspection Payment"
          : b.scheduled_start
            ? "Review Inspection Findings"
            : "Arrange Inspection",
      description:
        "Inspection and its configured fee may come before the final quotation.",
      section:
        b.inspection_pay_before_visit && Number(summary.inspection_due) > 0
          ? "Payments & requests"
          : b.scheduled_start
            ? "Work & completion"
            : "Team & schedule",
    };
  else if (!accepted)
    next = {
      title:
        currentQuote?.status === "approved"
          ? "Issue Quotation"
          : "Prepare Quotation",
      description: "The quotation defines the price, scope and payment terms.",
      section: "Quote & approval",
    };
  else if (b.contract_required && !approvedContract)
    next = {
      title: pendingContract
        ? "Waiting for Customer Contract Approval"
        : "Create Required Contract",
      description: "Only this project's required contract blocks execution.",
      section: "Quote & approval",
    };
  else if (requiredOutstanding > 0)
    next = {
      title: "Verify Required Payment",
      description: paymentState,
      section: "Payments & requests",
    };
  else if (startBlocks.length)
    next = {
      title: "Confirm Required Team & Schedule",
      description: startBlocks[0],
      section: "Team & schedule",
    };
  else
    next = {
      title: "Ready for Work Execution",
      description: "Start on the confirmed date. Server checks still apply.",
      section: "Work & completion",
    };
  return {
    accepted,
    currentQuote,
    contractState,
    approvedContract,
    pendingContract,
    paymentState,
    requiredBeforeWork,
    requiredOutstanding,
    currentDue,
    startBlocks,
    completionBlocks,
    next,
  };
}
