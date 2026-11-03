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
  const [customer, providers, team, updates, proposals, audit] =
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
    ]);

  if (
    customer.error ||
    providers.error ||
    team.error ||
    updates.error ||
    proposals.error ||
    audit.error
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
  return (
    <section className={styles.page}>
      <PageHeading
        title={b.services?.name ?? "Managed booking"}
        description={`Booking ${id}`}
        trailing={<Link href="/admin/bookings">All bookings</Link>}
      />
      <div className={styles.head}>
        <StatusBadge status={b.official_status} />
        <span>Operations: {b.status.replaceAll("_", " ")}</span>
        <Link href={`/admin/chat?bookingRef=${id}`}>Booking conversation</Link>
      </div>
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
          <h2>Financial state</h2>
          <p>
            Gross approved total:{" "}
            {b.quote_total == null ? "Not quoted" : peso(Number(b.quote_total))}
          </p>
          <p>Net verified principal: {peso(Number(s.net_paid))}</p>
          <p>Inspection due: {peso(Number(s.inspection_due))}</p>
          <p>Execution requirement remaining: {peso(Number(s.deposit_due))}</p>
          <p>Eligible installments due: {peso(Number(s.milestone_due))}</p>
          <p>Final balance due: {peso(Number(s.balance_due))}</p>
          <p>Gateway fee per checkout: {peso(Number(b.gateway_fee))}</p>
          <p>
            Inspection payments are credited once. These dues overlap and must
            not be added together.
          </p>
        </article>
      </div>
      {["open", "offered", "accepted"].includes(b.status) && (
        <article className={styles.card}>
          <h2>Review request</h2>
          <ActionForm
            bookingId={id}
            action="admin_review"
            label="Save MAZ review decision"
            fields={[
              {
                name: "decision",
                label: "Decision",
                type: "select",
                options: [
                  { value: "accept", label: "Accept for MAZ processing" },
                  { value: "clarify", label: "Ask customer for clarification" },
                  { value: "decline", label: "Decline / cancel request" },
                ],
              },
              {
                name: "note",
                label: "Decision, coverage check and next step",
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
        </article>
      )}
      {active && (
        <article className={styles.card}>
          <h2>Team and appointment</h2>
          <TeamOfferForm
            bookings={[{ id, label: b.services?.name ?? id }]}
            providers={names}
          />
          <MazAppointmentForm
            bookingId={id}
            leads={(team.data ?? [])
              .filter((a) => a.status === "accepted")
              .map((a) => ({
                id: a.provider_id,
                label: `${name(a.provider_id)} - ${a.phase} - ${a.trade}`,
              }))}
          />
          <p>
            Providers propose work periods from their assignment. Every
            execution period needs customer agreement before MAZ confirmation.
          </p>
        </article>
      )}
      <article className={styles.card}>
        <h2>Assignments and date agreements</h2>
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
      </article>
      <article className={styles.card}>
        <h2>Quotation versions</h2>
        {quotes.map((q) => (
          <article key={q.id}>
            <strong>
              Version {q.version}: {q.status} - {peso(Number(q.amount))}
            </strong>
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
          </article>
        ))}
        {active && !accepted && (
          <QuoteBuilder bookingId={id} milestones={milestones} />
        )}
      </article>
      <article className={styles.card}>
        <h2>Contract and change orders</h2>
        {documents.map((d) => (
          <article key={d.id}>
            <strong>
              {d.title} - {d.kind} v{d.version} - {d.status}
            </strong>
            <p className={styles.document}>{d.body}</p>
            <p>
              Cost impact: {peso(Number(d.cost_delta))}; time impact:{" "}
              {d.days_delta} days.
            </p>
          </article>
        ))}
        {accepted && active && (
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
                  { value: "change_order", label: "Change order" },
                ],
              },
              { name: "title", label: "Document title", required: true },
              {
                name: "note",
                label:
                  "Full scope, terms, inclusions, exclusions, responsibilities and duration",
                type: "textarea",
                required: true,
              },
              {
                name: "costDelta",
                label: "Additional cost (change orders only, PHP)",
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
        )}
      </article>
      <article className={styles.card}>
        <h2>Verify manual payments</h2>
        <p>
          Check funds actually received in the MAZ account or cash ledger.
          Uploaded proof alone does not confirm payment.
        </p>
        {proofs.length ? (
          proofs.map((c) => (
            <article key={c.id} className={styles.card}>
              <strong>
                {c.method} / {c.purpose}: {peso(Number(c.amount))} - {c.status}
              </strong>
              <p>Reference: {c.reference}</p>
              {c.proofUrl && (
                <a href={c.proofUrl} target="_blank" rel="noreferrer">
                  View private payment proof (expires in 5 minutes)
                </a>
              )}
              {c.status === "pending" ? (
                <div className={styles.grid}>
                  {[true, false].map((approve) => (
                    <ActionForm
                      key={String(approve)}
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
                  ))}
                </div>
              ) : (
                <p>{c.decision_note}</p>
              )}
            </article>
          ))
        ) : (
          <p>No manual claims.</p>
        )}
        <h3>Payment acknowledgments</h3>
        {receipts.map((r) => (
          <p key={r.number}>
            {r.number} - {peso(Number(r.amount))} - {dayAndTime(r.issued_at)}
          </p>
        ))}
      </article>
      <article className={styles.card}>
        <h2>Customer requests and refunds</h2>
        {requests.length ? (
          requests.map((r) => {
            const payment = payments.find((p) => p.id === r.payment_id);
            return (
              <article className={styles.card} key={r.id}>
                <strong>
                  {r.kind} - {r.status}
                </strong>
                <p>{r.note}</p>
                {r.amount && <p>Requested amount: {peso(Number(r.amount))}</p>}
                {r.decision_note && <p>Decision: {r.decision_note}</p>}
                {r.reference && <p>Settlement: {r.reference}</p>}
                {r.status === "requested" && (
                  <div className={styles.grid}>
                    {[true, false].map((approve) => (
                      <ActionForm
                        key={String(approve)}
                        bookingId={id}
                        action="admin_resolve_request"
                        label={approve ? "Approve request" : "Deny request"}
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
                          label: "Verified refund transfer / cash reference",
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
        ) : (
          <p>No customer requests.</p>
        )}
      </article>
      <article className={styles.card}>
        <h2>Milestones and provider evidence</h2>
        {milestones.map((m) => (
          <p key={m.id}>
            {m.position}. {m.title} - {m.status}
          </p>
        ))}
        {active && <WorkMilestoneForm bookingId={id} />}
        <p>
          Provider progress is shared with the customer only after MAZ approval.
          A worker completion does not close the project.
        </p>
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
      </article>
      <article className={styles.card}>
        <h2>Project control</h2>
        {b.status === "scheduled" && (
          <ActionForm
            bookingId={id}
            action="admin_start"
            label="Authorize execution on the confirmed work day"
          />
        )}
        {b.status === "in_progress" && (
          <ActionForm
            bookingId={id}
            action="admin_finish"
            label="Verify evidence and sign off project completion"
          />
        )}
        {b.status === "done" && (
          <p>Awaiting customer turnover acknowledgment.</p>
        )}
        {b.status === "signed" && (
          <ActionForm
            bookingId={id}
            action="admin_close"
            label="Reconcile fully paid balance and close project"
          />
        )}
        <p>
          Completion, customer turnover and financial closure are distinct
          checkpoints.
        </p>
      </article>
      {["done", "signed", "balance_paid", "completed"].includes(b.status) && (
        <article className={styles.card}>
          <h2>Project publication</h2>
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
        </article>
      )}
      <article className={styles.card}>
        <h2>Booking audit</h2>
        {audit.data?.map((a, index) => (
          <p key={index}>
            {dayAndTime(a.created_at)} - {a.action}
            {a.reason ? ` - ${a.reason}` : ""}
          </p>
        ))}
        <Link href="/admin/audit-log">View full audit log</Link>
      </article>
    </section>
  );
}
