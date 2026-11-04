import { CreditCard, MapPin, UserRound } from "lucide-react";
import detail from "./admin-detail.module.css";
import { BookingWorkspace } from "./booking-workspace";
import { ActionLink } from "@/components/ui/action-link";
import { BookingSection } from "./booking-section";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/layout/page-heading";
import { StatusBadge } from "@/components/booking/status-badge";
import {
  TeamOfferForm,
  MazAppointmentForm,
  WorkMilestoneForm,
  WorkReviewControls,
} from "@/components/provider/admin-work-controls";
import { AssignmentReleaseForm } from "@/components/provider/assignment-release-form";
import { workflowSession } from "@/lib/workflow/session";
import { acceptedTeamLeads } from "@/lib/provider/team";
import { loadManagedBooking } from "@/lib/workflow/load";
import { dayAndTime, peso } from "@/lib/matching/format";
import { ActionForm } from "./action-form";
import { ApprovalPanels } from "./approval-panels";
import { bookingApprovalState } from "@/lib/workflow/approval-state";
import approval from "./approval.module.css";
import { GatewayRefundForm } from "./admin-operation-form";
import { PortfolioPublishForm } from "./portfolio-publish-form";
import styles from "./workflow.module.css";

export async function AdminBooking({ id }: { id: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { client } = await workflowSession("admin");
  const record = await loadManagedBooking(client, id);
  if (record.error)
    return (
      <p role="alert">Could not load the managed booking. Please refresh.</p>
    );
  const {
    booking: b,
    summary: s,
    quotes,
    documents,
    claims,
    requests,
    milestones,
    payments,
    receipts,
  } = record;
  if (!b || !s) notFound();
  const [
    customer,
    providers,
    qualifiedServices,
    team,
    updates,
    proposals,
    audit,
    legacyOffers,
  ] = await Promise.all([
    client
      .from("profiles")
      .select("first_name,last_name,mobile")
      .eq("id", b.customer_id)
      .maybeSingle(),
    client
      .from("provider_profiles")
      .select(
        "profile_id,profiles!provider_profiles_profile_id_fkey(first_name,last_name)",
      )
      .eq("status", "approved"),
    client
      .from("provider_services")
      .select("provider_id")
      .eq("service_id", b.service_id ?? "00000000-0000-0000-0000-000000000000"),
    client
      .from("provider_assignments")
      .select("*")
      .eq("booking_id", id)
      .order("created_at"),
    client
      .from("provider_work_updates")
      .select("*")
      .eq("booking_id", id)
      .order("created_at", { ascending: false }),
    client
      .from("provider_appointment_requests")
      .select("*")
      .eq("booking_id", id)
      .order("created_at", { ascending: false }),
    client
      .from("audit_log")
      .select("action,reason,created_at")
      .eq("target_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    client
      .from("offers")
      .select("provider_id")
      .eq("booking_id", id)
      .eq("status", "accepted"),
  ]);

  if (
    customer.error ||
    providers.error ||
    qualifiedServices.error ||
    team.error ||
    updates.error ||
    proposals.error ||
    audit.error ||
    legacyOffers.error
  )
    return (
      <p role="alert">Could not load booking operations. Please refresh.</p>
    );
  const names = (providers.data ?? []).map((p) => {
    const person = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    return {
      id: p.profile_id,
      label:
        [person?.first_name, person?.last_name].filter(Boolean).join(" ") ||
        "MAZ worker",
    };
  });
  const qualifiedProviderIds = new Set(
    (qualifiedServices.data ?? []).map((row) => row.provider_id),
  );
  const qualifiedNames = names.filter((provider) =>
    qualifiedProviderIds.has(provider.id),
  );
  const name = (pid: string) =>
    names.find((p) => p.id === pid)?.label ?? "MAZ worker";
  const evidence = await Promise.all(
    (updates.data ?? []).map(async (u) => {
      const { data } = u.photo_paths.length
        ? await client.storage
            .from("proof-photos")
            .createSignedUrls(u.photo_paths, 300)
        : { data: [] };
      return { ...u, photos: data ?? [] };
    }),
  );
  const proofs = await Promise.all(
    claims.map(async (c) => {
      const { data } = c.proof_path
        ? await client.storage
            .from("receipts")
            .createSignedUrl(c.proof_path, 300)
        : { data: null };
      return { ...c, proofUrl: data?.signedUrl };
    }),
  );
  const active = ![
    "done",
    "signed",
    "balance_paid",
    "completed",
    "cancelled",
  ].includes(b.status);
  const accepted = quotes.find((q) => q.status === "accepted");
  const confirmationPhase =
    accepted ||
    !b.inspection_required ||
    evidence.some(
      (u) => u.kind === "inspection" && u.review_status === "approved",
    )
      ? "execution"
      : "inspection";
  const leadOptions = acceptedTeamLeads(
    team.data ?? [],
    qualifiedNames,
    confirmationPhase,
    b.provider_id,
    (legacyOffers.data ?? []).map((o) => o.provider_id),
  );
  const waiting = (team.data ?? [])
    .filter(
      (a) =>
        a.phase === confirmationPhase &&
        ["offered", "withdrawal_requested"].includes(a.status),
    )
    .map((a) => ({
      name: `${name(a.provider_id)} (${a.trade})`,
      status: a.status,
    }));
  const confirmationBlocks: string[] = [];
  if (!b.admin_accepted_at)
    confirmationBlocks.push("Save an Accept decision in Review request first.");
  if (confirmationPhase === "execution") {
    if (Number(s.deposit_due) > 0)
      confirmationBlocks.push(
        "Verify the configured payment required before execution.",
      );
    if (
      b.contract_required &&
      !documents.some((d) => d.kind === "contract" && d.status === "accepted")
    )
      confirmationBlocks.push(
        "Have the customer approve the required contract.",
      );
    if (waiting.length)
      confirmationBlocks.push(
        "All execution roles must be assigned; release or replace unresolved roles.",
      );
  }
  if (
    confirmationPhase === "inspection" &&
    b.inspection_pay_before_visit &&
    Number(s.inspection_due) > 0
  )
    confirmationBlocks.push(
      "Verify the disclosed inspection fee before the visit.",
    );
  const approvalState = bookingApprovalState({
    booking: b,
    summary: s,
    quotes,
    documents,
    assignments: team.data ?? [],
    evidence,
    milestones,
    pendingClaims: claims.some((claim) => claim.status === "pending"),
    approvedProviderIds: new Set(qualifiedNames.map((provider) => provider.id)),
    legacyAccepted: (legacyOffers.data ?? []).map((offer) => offer.provider_id),
  });
  const inspectionCredit = Math.min(
    Number(b.inspection_fee),
    payments.reduce(
      (paid, payment) =>
        payment.purpose === "inspection" &&
        ["paid", "partially_refunded"].includes(payment.status)
          ? paid + Number(payment.amount) - Number(payment.refunded_amount ?? 0)
          : paid,
      0,
    ),
  );
  return (
    <section className={styles.page}>
      <PageHeading
        title={b.services?.name ?? "Managed booking"}
        description={`Booking ${id.slice(0, 8)}`}
        trailing={<ActionLink href="/admin/bookings">All bookings</ActionLink>}
      />
      <div className={styles.head}>
        <StatusBadge status={b.official_status} />
        <ActionLink href={`/admin/chat?bookingRef=${id}`}>
          Booking conversation
        </ActionLink>
      </div>
      <BookingWorkspace nextAction={approvalState.next}>
        <BookingSection title="Overview" presentation="plain">
          <div className={detail.summaryGrid}>
            <article className={detail.card}>
              <h2 className={detail.cardTitle}>
                <UserRound aria-hidden="true" />
                Customer request
              </h2>
              <div className={detail.customer}>
                <strong>
                  {b.manual_customer_name ??
                    (`${customer.data?.first_name ?? ""} ${customer.data?.last_name ?? ""}`.trim() ||
                      "Customer")}
                </strong>
                {(b.manual_customer_mobile ?? customer.data?.mobile) && (
                  <p>{b.manual_customer_mobile ?? customer.data?.mobile}</p>
                )}
                <p>{b.description}</p>
              </div>
              <p className={detail.location}>
                <MapPin aria-hidden="true" />
                {b.manual_customer_address ??
                  ([
                    b.addresses?.line1,
                    b.addresses?.barangay,
                    b.addresses?.city,
                  ]
                    .filter(Boolean)
                    .join(", ") ||
                    "Address not provided")}
              </p>
              <dl className={detail.facts}>
                <div>
                  <dt>Requested</dt>
                  <dd>
                    {b.preferred_start
                      ? dayAndTime(b.preferred_start)
                      : "Urgent; no confirmed time"}
                  </dd>
                </div>
                {b.alternate_start && (
                  <div>
                    <dt>Alternate</dt>
                    <dd>{dayAndTime(b.alternate_start)}</dd>
                  </div>
                )}
                <div>
                  <dt>Confirmed</dt>
                  <dd>
                    {b.scheduled_start
                      ? dayAndTime(b.scheduled_start)
                      : "Not confirmed"}
                  </dd>
                </div>
                {b.preferred_worker_note && (
                  <div>
                    <dt>Preferred worker</dt>
                    <dd>{b.preferred_worker_note}</dd>
                  </div>
                )}
              </dl>
              <div className={detail.decision}>
                <strong>MAZ decision</strong>
                <p>{b.admin_review_note ?? "Needs review"}</p>
              </div>
            </article>
            <article className={detail.card}>
              <h2 className={detail.cardTitle}>
                <CreditCard aria-hidden="true" />
                Payments summary
              </h2>
              <dl className={detail.facts}>
                <div>
                  <dt>Approved total</dt>
                  <dd>
                    {b.quote_total == null
                      ? "Not quoted"
                      : peso(Number(b.quote_total))}
                  </dd>
                </div>
                <div>
                  <dt>Verified payments</dt>
                  <dd>{peso(Number(s.net_paid))}</dd>
                </div>
                <div className={detail.balance}>
                  <dt>Remaining balance:</dt>
                  <dd>
                    {b.quote_total == null
                      ? "Not quoted"
                      : peso(
                          Math.max(
                            0,
                            Number(b.quote_total) - Number(s.net_paid),
                          ),
                        )}
                  </dd>
                </div>
                <div>
                  <dt>Required before work</dt>
                  <dd>{peso(approvalState.requiredBeforeWork)}</dd>
                </div>
                <div>
                  <dt>Currently due</dt>
                  <dd>{peso(approvalState.currentDue)}</dd>
                </div>
              </dl>
              <p className={approval.status}>{approvalState.paymentState}</p>
              <details className={detail.breakdown}>
                <summary>Payment breakdown</summary>
                <dl className={detail.facts}>
                  <div>
                    <dt>Inspection due</dt>
                    <dd>{peso(Number(s.inspection_due))}</dd>
                  </div>
                  <div>
                    <dt>Required before work</dt>
                    <dd>{peso(Number(s.deposit_due))}</dd>
                  </div>
                  <div>
                    <dt>Installments due</dt>
                    <dd>{peso(Number(s.milestone_due))}</dd>
                  </div>
                  <div>
                    <dt>Final payment due now</dt>
                    <dd>{peso(Number(s.balance_due))}</dd>
                  </div>
                  <div>
                    <dt>Checkout fee</dt>
                    <dd>{peso(Number(b.gateway_fee))}</dd>
                  </div>
                </dl>
                <p className={styles.muted}>
                  Requirements can overlap; do not add them together.
                </p>
              </details>
            </article>
          </div>
        </BookingSection>
        {["open", "offered", "accepted"].includes(b.status) && (
          <BookingSection title="Review request" open={!b.admin_accepted_at}>
            <ActionForm
              bookingId={id}
              action="admin_review"
              label="Save decision"
              fields={[
                {
                  name: "decision",
                  label: "Decision",
                  type: "select",
                  options: [
                    { value: "accept", label: "Accept request" },
                    {
                      value: "clarify",
                      label: "Ask customer for clarification",
                    },
                    { value: "decline", label: "Decline / cancel request" },
                  ],
                },
                {
                  name: "note",
                  label: "Review notes",
                  type: "textarea",
                  required: true,
                  value: b.admin_review_note ?? "",
                },
                {
                  name: "inspectionRequired",
                  label: "Inspection required",
                  type: "checkbox",
                  value: b.inspection_required,
                },
                {
                  name: "chargeInspection",
                  label:
                    "This selected service requires a PHP 1,500 inspection fee",
                  type: "checkbox",
                  value: Number(b.inspection_fee) > 0,
                },
                {
                  name: "payInspectionBeforeVisit",
                  label: "Inspection payment must be verified before the visit",
                  type: "checkbox",
                  value: b.inspection_pay_before_visit,
                },
                {
                  name: "contractRequired",
                  label:
                    "Require customer approval of a written agreement before work starts",
                  type: "checkbox",
                  value: b.contract_required,
                  hint: "Select before issuing the quotation: required contract means 50% down payment. Leave off for small one-day services paid after completion.",
                },
              ]}
            />
          </BookingSection>
        )}
        {active && (
          <BookingSection
            title="Team & schedule"
            open={[
              "open",
              "offered",
              "accepted",
              "quoted",
              "deposit_paid",
            ].includes(b.status)}
          >
            <details
              open={
                !team.data?.some(
                  (a) =>
                    a.phase === confirmationPhase &&
                    ["offered", "accepted"].includes(a.status),
                )
              }
            >
              <summary>Add workers</summary>
              <TeamOfferForm
                key={`${id}-${confirmationPhase}`}
                bookings={[
                  {
                    id,
                    label: b.services?.name ?? id,
                    category: b.services?.category,
                    isRenovation:
                      b.is_major_renovation ||
                      b.services?.category === "Renovation",
                  },
                ]}
                providers={qualifiedNames}
                serviceLabel={b.services?.name ?? "this service"}
                existingAssignments={team.data ?? []}
                initialPhase={confirmationPhase}
              />
            </details>
            {["open", "offered", "accepted", "quoted", "deposit_paid"].includes(
              b.status,
            ) ? (
              <MazAppointmentForm
                bookingId={id}
                leads={leadOptions}
                phase={confirmationPhase}
                waiting={waiting}
                blockedReasons={confirmationBlocks}
              />
            ) : (
              <p>Appointment confirmed.</p>
            )}

            {team.data?.length ? (
              <details>
                <summary>Assigned workers</summary>
                {team.data?.map((a) => (
                  <article key={a.id}>
                    <strong>
                      {name(a.provider_id)} - {a.trade} - {a.phase} -{" "}
                      {a.status === "accepted" ? "Assigned" : a.status}
                    </strong>
                    <p>
                      {dayAndTime(a.starts_at)} to {dayAndTime(a.ends_at)}
                    </p>
                    {a.response_note &&
                      !a.response_note.startsWith(
                        "Assigned directly by MAZ",
                      ) && <p>{a.response_note}</p>}
                    {active &&
                      ["offered", "accepted", "withdrawal_requested"].includes(
                        a.status,
                      ) && <AssignmentReleaseForm id={a.id} admin />}
                  </article>
                ))}
              </details>
            ) : null}
          </BookingSection>
        )}

        <BookingSection title="Quote & approval" presentation="plain">
          <ApprovalPanels
            contractRequired={b.contract_required}
            bookingId={id}
            state={approvalState}
            quotes={quotes}
            documents={documents}
            milestones={milestones}
            active={active}
            manualCustomer={!!b.manual_customer_name}
            canQuote={
              !!b.admin_accepted_at &&
              (!b.inspection_required ||
                evidence.some(
                  (update) =>
                    update.kind === "inspection" &&
                    update.review_status === "approved",
                ))
            }
            inspectionCredit={inspectionCredit}
          />
        </BookingSection>
        {(b.admin_accepted_at ||
          quotes.length > 0 ||
          claims.length > 0 ||
          receipts.length > 0 ||
          requests.length > 0) && (
          <BookingSection
            title="Payments & requests"
            open={
              claims.some((c) => c.status === "pending") ||
              requests.some((r) => r.status === "requested")
            }
          >
            {claims.length > 0 && (
              <p className={styles.muted}>
                Verify funds received before approving a payment.
              </p>
            )}
            <p className={approval.status}>{approvalState.paymentState}</p>
            <p>
              Currently due: {peso(approvalState.currentDue)}. The remaining
              balance may become payable later.
            </p>
            {proofs.length
              ? proofs.map((c) => (
                  <article key={c.id} className={styles.card}>
                    <strong>
                      {c.method} / {c.purpose}: {peso(Number(c.amount))} -{" "}
                      {c.status}
                    </strong>
                    <p>Reference: {c.reference}</p>
                    {c.proofUrl && (
                      <ActionLink
                        href={c.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View payment proof
                      </ActionLink>
                    )}
                    {c.status === "pending" ? (
                      <div className={styles.grid}>
                        {[true, false].map((approve) => (
                          <details key={String(approve)}>
                            <summary>
                              {approve ? "Verify payment" : "Reject claim"}
                            </summary>
                            <ActionForm
                              bookingId={id}
                              action="admin_verify_payment"
                              label={
                                approve
                                  ? "Verify funds received"
                                  : "Reject payment claim"
                              }
                              values={{ id: c.id, approve }}
                              fields={[
                                {
                                  name: "note",
                                  label: approve
                                    ? "How actual receipt was verified"
                                    : "Rejection reason",
                                  type: "textarea",
                                  required: true,
                                },
                              ]}
                            />
                          </details>
                        ))}
                      </div>
                    ) : (
                      <p>{c.decision_note}</p>
                    )}
                  </article>
                ))
              : null}
            {receipts.length > 0 && <h3>Receipts</h3>}
            {receipts.map((r) => (
              <p key={r.number}>
                {r.number} - {peso(Number(r.amount))} -{" "}
                {dayAndTime(r.issued_at)}
              </p>
            ))}
            {requests.length > 0 && <h3>Customer requests</h3>}
            {requests.length
              ? requests.map((r) => {
                  const payment = payments.find((p) => p.id === r.payment_id);
                  return (
                    <article className={styles.card} key={r.id}>
                      <strong>
                        {r.kind} - {r.status}
                      </strong>
                      <p>{r.note}</p>
                      {r.amount && (
                        <p>Requested amount: {peso(Number(r.amount))}</p>
                      )}
                      {r.decision_note && <p>Decision: {r.decision_note}</p>}
                      {r.reference && <p>Settlement: {r.reference}</p>}
                      {r.status === "requested" && (
                        <div className={styles.grid}>
                          {[true, false].map((approve) => (
                            <details key={String(approve)}>
                              <summary>
                                {approve ? "Approve request" : "Deny request"}
                              </summary>
                              <ActionForm
                                bookingId={id}
                                action="admin_resolve_request"
                                label={
                                  approve ? "Approve request" : "Deny request"
                                }
                                values={{ id: r.id, approve }}
                                fields={[
                                  {
                                    name: "note",
                                    label: "Decision and customer explanation",
                                    type: "textarea",
                                    required: true,
                                  },
                                ]}
                              />
                            </details>
                          ))}
                        </div>
                      )}
                      {r.kind === "refund" &&
                        r.status === "approved" &&
                        (payment?.paymongo_payment_id ? (
                          <GatewayRefundForm bookingId={id} requestId={r.id} />
                        ) : (
                          <ActionForm
                            bookingId={id}
                            action="admin_record_refund"
                            label="Record actual manual refund settlement"
                            values={{ id: r.id }}
                            fields={[
                              {
                                name: "reference",
                                label:
                                  "Verified refund transfer / cash reference",
                                required: true,
                              },
                              {
                                name: "note",
                                label: "Settlement verification details",
                                type: "textarea",
                                required: true,
                              },
                            ]}
                          />
                        ))}
                    </article>
                  );
                })
              : null}
          </BookingSection>
        )}

        {(accepted ||
          b.scheduled_start ||
          evidence.length > 0 ||
          milestones.length > 0) && (
          <BookingSection
            title="Work & completion"
            open={
              evidence.some((u) => u.review_status === "pending") ||
              ["scheduled", "in_progress", "done", "signed"].includes(b.status)
            }
          >
            <p className={styles.muted}>
              Review worker updates, then approve completed work.
            </p>
            {b.status === "scheduled" &&
              approvalState.startBlocks.length > 0 && (
                <ul className={approval.checklist}>
                  {approvalState.startBlocks.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            {b.status === "in_progress" &&
              approvalState.completionBlocks.length > 0 && (
                <ul className={approval.checklist}>
                  {approvalState.completionBlocks.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            {milestones.map((m) => (
              <p key={m.id}>
                {m.position}. {m.title} - {m.status}
              </p>
            ))}
            {active && accepted && <WorkMilestoneForm bookingId={id} />}
            {!evidence.length && <p>No worker updates yet.</p>}
            {evidence.map((u) => (
              <article key={u.id} className={styles.card}>
                <strong>
                  {name(u.provider_id)} - {u.kind} - {u.review_status}
                </strong>
                <p className={styles.document}>{u.notes}</p>
                <div className={styles.actions}>
                  {u.photos.map(
                    (photo: { signedUrl?: string | null }, n: number) =>
                      photo.signedUrl && (
                        <a
                          key={n}
                          href={photo.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Private evidence {n + 1}
                        </a>
                      ),
                  )}
                </div>
                {u.review_status === "pending" && (
                  <WorkReviewControls
                    id={u.id}
                    bookingId={id}
                    completion={u.kind === "completion"}
                  />
                )}
              </article>
            ))}

            {b.status === "scheduled" && !approvalState.startBlocks.length && (
              <ActionForm
                bookingId={id}
                action="admin_start"
                label="Start work"
              />
            )}
            {b.status === "in_progress" &&
              !approvalState.completionBlocks.length && (
                <ActionForm
                  bookingId={id}
                  action="admin_finish"
                  label="Approve completed work"
                />
              )}
            {b.status === "done" && (
              <p>Awaiting customer turnover acknowledgment.</p>
            )}
            {b.status === "signed" &&
              Number(s.net_paid) >= Number(b.quote_total ?? 0) && (
                <ActionForm
                  bookingId={id}
                  action="admin_close"
                  label="Close booking"
                />
              )}
            {b.status === "signed" &&
              Number(s.net_paid) < Number(b.quote_total ?? 0) && (
                <p>Verify the final payment before closing this booking.</p>
              )}
          </BookingSection>
        )}

        {["done", "signed", "balance_paid", "completed"].includes(b.status) && (
          <BookingSection title="Share project photos (optional)">
            <p>
              Separate customer photo permission:{" "}
              {record.consent?.photos_allowed
                ? "Granted"
                : "Not granted / withdrawn"}
            </p>
            {record.consent?.photos_allowed && (
              <PortfolioPublishForm
                bookingId={id}
                paths={[
                  ...new Set(
                    evidence
                      .filter((u) => u.review_status === "approved")
                      .flatMap((u) => u.photo_paths as string[]),
                  ),
                ]}
              />
            )}
          </BookingSection>
        )}
        <BookingSection title="Activity history">
          {!active && (team.data?.length || proposals.data?.length) ? (
            <details>
              <summary>Past workers and dates</summary>
              {team.data?.map((a) => (
                <article key={a.id}>
                  <strong>
                    {name(a.provider_id)} - {a.trade} - {a.phase} - {a.status}
                  </strong>
                  <p>
                    {dayAndTime(a.starts_at)} to {dayAndTime(a.ends_at)}
                  </p>
                  {a.response_note && <p>{a.response_note}</p>}
                  {active &&
                    ["offered", "accepted", "withdrawal_requested"].includes(
                      a.status,
                    ) && <AssignmentReleaseForm id={a.id} admin />}
                </article>
              ))}
              {proposals.data?.map((p) => (
                <p key={p.id}>
                  {p.phase} proposal: {dayAndTime(p.starts_at)} to{" "}
                  {dayAndTime(p.ends_at)} - customer {p.status}
                </p>
              ))}
            </details>
          ) : null}
          {audit.data?.length ? (
            <ol className={detail.activityList}>
              {audit.data.map((a, index) => (
                <li key={index}>
                  <span className={detail.activityDot} aria-hidden="true" />
                  <div>
                    <strong>
                      {(
                        {
                          "workflow.admin_review": "Request reviewed",
                          "matching.ranked": "Provider recommendations updated",
                          "booking.status": "Booking status updated",
                        } as Record<string, string>
                      )[a.action] ??
                        a.action
                          .replace(/[._]/g, " ")
                          .replace(/^./, (c: string) => c.toUpperCase())}
                    </strong>
                    <time dateTime={a.created_at}>
                      {dayAndTime(a.created_at)}
                    </time>
                    {a.reason && <p>{a.reason}</p>}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.muted}>No activity recorded yet.</p>
          )}
          <ActionLink href="/admin/audit-log">
            View full activity log
          </ActionLink>
        </BookingSection>
      </BookingWorkspace>
    </section>
  );
}
