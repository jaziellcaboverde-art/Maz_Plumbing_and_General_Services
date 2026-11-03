import { BookingSection } from "./booking-section";
import Link from "next/link";
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
import { QuoteBuilder } from "./quote-builder";
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
  const [customer, providers, team, updates, proposals, audit, legacyOffers] =
    await Promise.all([
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
  const currentQuote =
    accepted ?? quotes.find((q) => q.status === "approved") ?? quotes[0];
  const needsContract =
    !!accepted &&
    b.contract_required &&
    !documents.some((d) => d.kind === "contract" && d.status === "accepted");
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
    names,
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
    if (!accepted)
      confirmationBlocks.push(
        "Issue the MAZ quotation and have the customer approve it before confirming execution.",
      );
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
        "All execution roles must be accepted, or unresolved roles must be released/replaced.",
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
  const awaitingDateAgreement = (team.data ?? []).some(
    (a) =>
      a.phase === confirmationPhase &&
      a.status === "accepted" &&
      (confirmationPhase === "execution" ||
        Date.parse(a.starts_at) !== Date.parse(b.preferred_start ?? "")) &&
      !(proposals.data ?? []).some(
        (p) =>
          p.phase === confirmationPhase &&
          p.status === "accepted" &&
          Date.parse(p.starts_at) === Date.parse(a.starts_at) &&
          Date.parse(p.ends_at) === Date.parse(a.ends_at),
      ),
  );
  if (awaitingDateAgreement)
    confirmationBlocks.push(
      "Have the customer accept the proposed work period in their booking's Appointment proposals section.",
    );
  const nextStep =
    b.status === "cancelled"
      ? "This booking is cancelled. Review any outstanding refund request."
      : ["balance_paid", "completed"].includes(b.status)
        ? "This booking is closed."
        : b.status === "signed"
          ? "Verify the final balance, then close the booking."
          : b.status === "done"
            ? "Wait for the customer to acknowledge the completed work."
            : b.status === "in_progress"
              ? "Review worker updates. Approve the completed work when all evidence is ready."
              : b.status === "scheduled"
                ? "Start work on the confirmed date."
                : !b.admin_accepted_at
                  ? "Review the customer request first."
                  : confirmationPhase === "execution" && !accepted
                    ? quotes.some((q) => q.status === "approved")
                      ? "Wait for the customer to approve the quotation."
                      : "Prepare the quotation for customer approval."
                    : needsContract
                      ? documents.some(
                          (d) => d.kind === "contract" && d.status === "issued",
                        )
                        ? "Wait for the customer to approve the contract."
                        : "Create the required contract for customer approval."
                      : !leadOptions.length
                        ? waiting.length
                          ? "Wait for workers to accept their offers."
                          : "Assign workers and choose an available schedule."
                        : confirmationPhase === "inspection"
                          ? b.scheduled_start
                            ? "Review the worker's inspection findings before preparing the quotation."
                            : "Confirm the inspection once its requirements are complete."
                          : !accepted
                            ? quotes.some((q) => q.status === "approved")
                              ? "Wait for the customer to approve the quotation."
                              : "Prepare the quotation for customer approval."
                            : "Complete the listed requirements, then confirm the work schedule.";
  return (
    <section className={styles.page}>
      <PageHeading
        title={b.services?.name ?? "Managed booking"}
        description={`Booking ${id.slice(0, 8)}`}
        trailing={<Link href="/admin/bookings">All bookings</Link>}
      />
      <div className={styles.head}>
        <StatusBadge status={b.official_status} />
        <span>Operations: {b.status.replaceAll("_", " ")}</span>
        <Link href={`/admin/chat?bookingRef=${id}`}>Booking conversation</Link>
      </div>
      <aside className={styles.card}>
        <strong>Next step</strong>
        <p>{nextStep}</p>
      </aside>
      <div className={styles.grid}>
        <article className={styles.card}>
          <h2>Customer request</h2>
          <p>
            {customer.data?.first_name} {customer.data?.last_name}
          </p>
          <p>{b.description}</p>
          <p>
            {[b.addresses?.line1, b.addresses?.barangay, b.addresses?.city]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p>
            Requested:{" "}
            {b.preferred_start
              ? dayAndTime(b.preferred_start)
              : "Urgent; no confirmed time"}
          </p>
          {b.alternate_start && (
            <p>Alternate request: {dayAndTime(b.alternate_start)}</p>
          )}
          <p>
            Confirmed:{" "}
            {b.scheduled_start
              ? dayAndTime(b.scheduled_start)
              : "Not confirmed"}
          </p>
          {b.preferred_worker_note && (
            <p>Preferred worker request: {b.preferred_worker_note}</p>
          )}
          <p>MAZ decision: {b.admin_review_note ?? "Needs review"}</p>
        </article>
        <article className={styles.card}>
          <h2>Payments summary</h2>
          <p>
            Approved total:{" "}
            {b.quote_total == null ? "Not quoted" : peso(Number(b.quote_total))}
          </p>
          <p>Verified payments: {peso(Number(s.net_paid))}</p>
          <p>
            Remaining balance:{" "}
            {b.quote_total == null
              ? "Not quoted"
              : peso(Math.max(0, Number(b.quote_total) - Number(s.net_paid)))}
          </p>
          <details>
            <summary>Payment breakdown</summary>
            <p>Inspection due: {peso(Number(s.inspection_due))}</p>
            <p>Required before work: {peso(Number(s.deposit_due))}</p>
            <p>Installments due: {peso(Number(s.milestone_due))}</p>
            <p>Final payment due now: {peso(Number(s.balance_due))}</p>
            <p>Checkout fee: {peso(Number(b.gateway_fee))}</p>
            <p className={styles.muted}>
              These requirements overlap; do not add them together.
            </p>
          </details>
        </article>
      </div>
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
                  { value: "clarify", label: "Ask customer for clarification" },
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
                label: "Customer must approve a contract before execution",
                type: "checkbox",
                value: b.contract_required,
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
              bookings={[{ id, label: b.services?.name ?? id }]}
              providers={names}
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

          {team.data?.length || proposals.data?.length ? (
            <details>
              <summary>Workers and date responses</summary>
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
        </BookingSection>
      )}

      {(b.admin_accepted_at || quotes.length > 0 || documents.length > 0) && (
        <BookingSection
          title="Quote & approval"
          open={
            (active && !accepted) ||
            needsContract ||
            documents.some((d) => d.status === "issued")
          }
        >
          <p className={styles.muted}>
            Prepare the price and scope for customer approval.
          </p>
          {quotes.map((q) => (
            <details key={q.id} open={q.id === currentQuote?.id}>
              <summary>
                {peso(Number(q.amount))} —{" "}
                {q.status === "accepted"
                  ? "Customer approved"
                  : q.status === "approved"
                    ? "Awaiting customer approval"
                    : q.status.replaceAll("_", " ")}
              </summary>
              <p className={styles.muted}>Quotation {q.version}</p>
              <p className={styles.document}>{q.notes}</p>
              <ul>
                {q.line_items.map((i, n) => (
                  <li key={n}>
                    {i.description}: {i.quantity} × {peso(Number(i.unitPrice))}
                  </li>
                ))}
              </ul>
              <p>
                Before execution: {peso(Number(q.deposit_amount))}
                {q.accepted_at
                  ? ` - Customer approved ${dayAndTime(q.accepted_at)}`
                  : ""}
              </p>
            </details>
          ))}
          {active && !accepted && (
            <QuoteBuilder bookingId={id} milestones={milestones} />
          )}
          {(documents.length > 0 || (accepted && active)) && (
            <h3>Contract or extra work</h3>
          )}
          {documents.map((d) => (
            <details key={d.id} open={d.status === "issued"}>
              <summary>
                {d.title} —{" "}
                {d.status === "issued"
                  ? "Awaiting customer approval"
                  : d.status}
              </summary>
              <p className={styles.document}>{d.body}</p>
              <p>
                Cost impact: {peso(Number(d.cost_delta))}; time impact:{" "}
                {d.days_delta} days.
              </p>
            </details>
          ))}
          {accepted && active && (
            <details
              open={
                b.contract_required &&
                !documents.some(
                  (d) => d.kind === "contract" && d.status === "accepted",
                )
              }
            >
              <summary>Create contract or extra work approval</summary>
              <ActionForm
                bookingId={id}
                action="admin_document"
                label="Issue document for customer approval"
                fields={[
                  {
                    name: "kind",
                    label: "Document",
                    type: "select",
                    options: [
                      { value: "contract", label: "Contract" },
                      { value: "change_order", label: "Extra work approval" },
                    ],
                  },
                  { name: "title", label: "Document title", required: true },
                  {
                    name: "note",
                    label: "Scope and terms",
                    type: "textarea",
                    required: true,
                  },
                  {
                    name: "costDelta",
                    label: "Extra work cost (PHP)",
                    type: "number",
                    value: 0,
                    min: 0,
                  },
                  {
                    name: "daysDelta",
                    label: "Additional days",
                    type: "number",
                    value: 0,
                    min: 0,
                  },
                ]}
              />
            </details>
          )}
        </BookingSection>
      )}

      {(claims.length > 0 || receipts.length > 0 || requests.length > 0) && (
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
          {proofs.length
            ? proofs.map((c) => (
                <article key={c.id} className={styles.card}>
                  <strong>
                    {c.method} / {c.purpose}: {peso(Number(c.amount))} -{" "}
                    {c.status}
                  </strong>
                  <p>Reference: {c.reference}</p>
                  {c.proofUrl && (
                    <a href={c.proofUrl} target="_blank" rel="noreferrer">
                      View payment proof
                    </a>
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
              {r.number} - {peso(Number(r.amount))} - {dayAndTime(r.issued_at)}
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

      {(b.scheduled_start || evidence.length > 0 || milestones.length > 0) && (
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

          {b.status === "scheduled" && (
            <ActionForm
              bookingId={id}
              action="admin_start"
              label="Start work"
            />
          )}
          {b.status === "in_progress" && (
            <ActionForm
              bookingId={id}
              action="admin_finish"
              label="Approve completed work"
            />
          )}
          {b.status === "done" && (
            <p>Awaiting customer turnover acknowledgment.</p>
          )}
          {b.status === "signed" && (
            <ActionForm
              bookingId={id}
              action="admin_close"
              label="Close booking"
            />
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
        {audit.data?.map((a, index) => (
          <p key={index}>
            {dayAndTime(a.created_at)} - {a.action}
            {a.reason ? ` - ${a.reason}` : ""}
          </p>
        ))}
        <Link href="/admin/audit-log">View full activity log</Link>
      </BookingSection>
    </section>
  );
}
