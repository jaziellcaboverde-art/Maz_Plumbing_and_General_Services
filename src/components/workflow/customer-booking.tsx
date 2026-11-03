import { ActionLink } from "@/components/ui/action-link";
import { BookingSection } from "./booking-section";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/layout/page-heading";
import { StatusBadge } from "@/components/booking/status-badge";
import { AppointmentProposals } from "@/components/provider/appointment-proposals";
import { ApprovedProjectUpdates } from "@/components/provider/approved-project-updates";
import { PrivateProviderFeedback } from "@/components/provider/private-feedback";
import { workflowSession } from "@/lib/workflow/session";
import { loadManagedBooking } from "@/lib/workflow/load";
import { canEditCompanyReview, remainingBalance } from "@/lib/workflow/rules";
import { dayAndTime, peso } from "@/lib/matching/format";
import { ActionForm } from "./action-form";
import { CustomerPayment } from "./customer-payment";
import styles from "./workflow.module.css";

export async function CustomerBooking({ id }: { id: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { client } = await workflowSession("customer");
  const record = await loadManagedBooking(client, id);
  if (record.error)
    return (
      <p role="alert">
        Could not load the booking. Please refresh or contact MAZ.
      </p>
    );
  const {
    booking: b,
    summary: s,
    quotes,
    documents,
    payments,
    claims,
    requests,
    milestones,
    review,
    consent,
    receipts,
  } = record;
  if (!b || !s) notFound();
  if (b.status === "draft")
    return (
      <section className={styles.page}>
        <PageHeading title="Draft request" />
        <ActionLink href={`/customer/bookings/new?draft=${id}`}>
          Continue your request
        </ActionLink>
      </section>
    );
  const quote = quotes.find((q) => ["approved", "accepted"].includes(q.status));
  const finished = b.official_status === "Completed";
  return (
    <section className={styles.page}>
      <PageHeading
        title={b.services?.name ?? "Service request"}
        description={`Booking ${id.slice(0, 8)}`}
        trailing={<ActionLink href="/customer/bookings">My bookings</ActionLink>}
      />
      <div className={styles.head}>
        <StatusBadge status={b.official_status} />
        <ActionLink href={`/customer/chat?support=1&bookingRef=${id}`}>
          Contact MAZ
        </ActionLink>
      </div>
      <ol className={styles.timeline} aria-label="Booking progress">
        {["Pending", "Accepted", "Assigned", "Ongoing", "Completed"].map(
          (stage) => (
            <li
              key={stage}
              aria-current={b.official_status === stage ? "step" : undefined}
            >
              {stage}
            </li>
          ),
        )}
      </ol>
      <article className={styles.card}>
        <h2>What happens next</h2>
        <p>
          {b.official_status === "Cancelled"
            ? (b.cancel_reason ??
              "MAZ cancelled this request. Any refund is reviewed separately.")
            : b.status === "done"
              ? "Review the completed work and acknowledge turnover below."
              : b.status === "signed"
                ? "MAZ is reconciling the final balance and project closure."
                : b.official_status === "Pending"
                  ? "MAZ is assessing your request and appointment. Your requested time is not confirmed."
                  : b.official_status === "Ongoing"
                    ? "Your assigned team is following the approved scope. MAZ reviews progress and milestone evidence."
                    : "Review any proposed dates, quotation or contract below. MAZ confirms the appointment and team."}
        </p>
        {b.admin_review_note && (
          <p>
            <strong>MAZ update:</strong> {b.admin_review_note}
          </p>
        )}
      </article>
      <div className={styles.grid}>
        <article className={styles.card}>
          <h2>Request and appointment</h2>
          <p>{b.description}</p>
          <p>
            Requested:{" "}
            {b.preferred_start
              ? dayAndTime(b.preferred_start)
              : "Urgent request - MAZ will confirm an available time"}
          </p>
          <p>
            Confirmed:{" "}
            {b.scheduled_start
              ? dayAndTime(b.scheduled_start)
              : "Awaiting MAZ confirmation"}
          </p>
          <p>
            {[b.addresses?.line1, b.addresses?.barangay, b.addresses?.city]
              .filter(Boolean)
              .join(", ")}
          </p>
          {b.preferred_worker_note && (
            <p>
              Preferred worker request: {b.preferred_worker_note}. MAZ confirms
              eligibility and availability.
            </p>
          )}
        </article>
        <article className={styles.card}>
          <h2>Project finances</h2>
          <p>
            Approved service total:{" "}
            {b.quote_total == null
              ? "Awaiting quotation"
              : peso(Number(b.quote_total))}
          </p>
          <p>Verified payments: {peso(Number(s.net_paid))}</p>
          <p>
            Remaining service balance:{" "}
            {b.quote_total == null
              ? "Not yet quoted"
              : peso(
                  remainingBalance(Number(b.quote_total), Number(s.net_paid)),
                )}
          </p>
          {b.inspection_required && (
            <p>
              Inspection:{" "}
              {Number(b.inspection_fee) > 0
                ? `${peso(Number(b.inspection_fee))}, credited once if you proceed. ${b.inspection_pay_before_visit ? "Payment is required before the visit." : "MAZ confirms when payment is due."}`
                : "No inspection charge configured."}
            </p>
          )}
          <p className={styles.muted}>
            Inspection is included in verified payments. Processing fees are
            separate.
          </p>
        </article>
      </div>
      {!finished && b.official_status !== "Cancelled" && (
        <AppointmentProposals bookingId={id} />
      )}
      <BookingSection title="Assigned team" open={false}>
        {!s.team.length ? (
          <p>MAZ will show the team after confirming assignments.</p>
        ) : (
          <ul className={styles.list}>
            {s.team.map((worker, index) => (
              <li key={worker.provider_id + worker.phase + index}>
                <strong>{worker.name}</strong>
                <p>
                  {worker.trade} - {worker.phase}
                </p>
                <p>
                  {dayAndTime(worker.starts_at)} to {dayAndTime(worker.ends_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </BookingSection>
      <BookingSection
        title="MAZ quotation"
        open={!!quote && quote.status !== "accepted"}
      >
        {!quote ? (
          <p>
            MAZ will issue a versioned quotation after reviewing the scope and
            any required findings.
          </p>
        ) : (
          <>
            <div className={styles.head}>
              <strong>
                Version {quote.version} - {quote.status}
              </strong>
              <strong>{peso(Number(quote.amount))}</strong>
            </div>
            <p className={styles.document}>{quote.notes}</p>
            {quote.line_items.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Quantity</th>
                      <th>Unit price</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.line_items.map((item, index) => (
                      <tr key={index}>
                        <td>{item.description}</td>
                        <td>{item.quantity}</td>
                        <td>{peso(Number(item.unitPrice))}</td>
                        <td>
                          {peso(Number(item.quantity) * Number(item.unitPrice))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p>
              Required payment before execution:{" "}
              {peso(Number(quote.deposit_amount ?? 0))}. Previous verified
              payments count toward this requirement.
            </p>
            {quote.payment_schedule?.length > 0 && (
              <>
                <h3>Agreed payment schedule</h3>
                <ul>
                  {quote.payment_schedule.map((i, index) => (
                    <li key={index}>
                      {i.label}: {peso(Number(i.amount))}
                      {i.dueAt ? ` - ${dayAndTime(i.dueAt)}` : ""}
                      {i.milestoneId
                        ? " - payable after MAZ approves the linked milestone"
                        : ""}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {quote.expires_at && (
              <p>Quote validity: {dayAndTime(quote.expires_at)}</p>
            )}
            {quote.status === "approved" && (
              <div className={styles.grid}>
                <ActionForm
                  bookingId={id}
                  action="respond_quote"
                  label={`Approve quotation version ${quote.version}`}
                  values={{
                    id: quote.id,
                    version: quote.version,
                    accept: true,
                  }}
                />
                <ActionForm
                  bookingId={id}
                  action="respond_quote"
                  label="Decline quotation"
                  values={{
                    id: quote.id,
                    version: quote.version,
                    accept: false,
                  }}
                  fields={[
                    {
                      name: "note",
                      label: "Reason / questions",
                      type: "textarea",
                    },
                  ]}
                />
              </div>
            )}
          </>
        )}
      </BookingSection>
      {documents.length > 0 && (
        <BookingSection
          title="Contracts and change orders"
          open={documents.some((d) => d.status === "issued")}
        >
          {documents.map((doc) => (
            <article className={styles.card} key={doc.id}>
              <strong>
                {doc.title} - {doc.kind.replaceAll("_", " ")} v{doc.version}
              </strong>
              <p className={styles.document}>{doc.body}</p>
              <p>
                Status: {doc.status}.{" "}
                {doc.kind === "change_order"
                  ? `Cost change ${peso(Number(doc.cost_delta))}; time impact ${doc.days_delta} days.`
                  : "Approval records your account, document version and time."}
              </p>
              {doc.status === "issued" && (
                <div className={styles.grid}>
                  <ActionForm
                    bookingId={id}
                    action="respond_document"
                    label="Approve this document version"
                    values={{ id: doc.id, version: doc.version, accept: true }}
                  />
                  <ActionForm
                    bookingId={id}
                    action="respond_document"
                    label="Decline document"
                    values={{ id: doc.id, version: doc.version, accept: false }}
                  />
                </div>
              )}
            </article>
          ))}
        </BookingSection>
      )}
      <BookingSection
        title="Pay MAZ"
        open={
          Number(s.inspection_due) > 0 ||
          Number(s.deposit_due) > 0 ||
          Number(s.milestone_due) > 0 ||
          ["done", "signed"].includes(b.status)
        }
      >
        <CustomerPayment
          bookingId={id}
          dues={{
            inspection: Number(s.inspection_due),
            deposit: Number(s.deposit_due),
            milestone: Number(s.milestone_due),
            balance: Number(s.balance_due),
          }}
          fee={Number(b.gateway_fee)}
          instructions={record.instructions}
        />
        <h3>Payment submissions</h3>
        {claims.length ? (
          claims.map((claim) => (
            <p key={claim.id}>
              {claim.method} - {peso(Number(claim.amount))} - {claim.status}
              {claim.decision_note ? `: ${claim.decision_note}` : ""}
            </p>
          ))
        ) : (
          <p>No manual payment submissions.</p>
        )}
        <h3>Payment acknowledgments</h3>
        {receipts.map((receipt) => (
          <p key={receipt.number}>
            {receipt.number} - {peso(Number(receipt.amount))} -{" "}
            {dayAndTime(receipt.issued_at)}
          </p>
        ))}
      </BookingSection>
      {milestones.length > 0 && (
        <BookingSection title="Project milestones" open={false}>
          <ol>
            {milestones.map((m) => (
              <li key={m.id}>
                {m.title} -{" "}
                {m.status === "confirmed"
                  ? "Approved by MAZ"
                  : m.status === "submitted"
                    ? "Evidence under review"
                    : "Pending work / evidence"}
                {m.due_at ? ` - Due ${dayAndTime(m.due_at)}` : ""}
              </li>
            ))}
          </ol>
        </BookingSection>
      )}
      <ApprovedProjectUpdates bookingId={id} />
      {b.status === "done" && (
        <article className={styles.card}>
          <h2>Turnover</h2>
          <p>
            MAZ verified the completion evidence. If anything needs correction,
            use the dispute request below before acknowledging turnover.
          </p>
          <ActionForm
            bookingId={id}
            action="turnover"
            label="Acknowledge completed work and turnover"
            fields={[
              { name: "note", label: "Turnover notes", type: "textarea" },
            ]}
          />
        </article>
      )}
      <BookingSection title="Requests and support" open={false}>
        <p>
          MAZ reviews cancellation, changes, disputes and refunds. No automatic
          cancellation penalty applies.
        </p>
        <ActionForm
          bookingId={id}
          action="customer_request"
          label="Send request to MAZ"
          fields={[
            {
              name: "kind",
              label: "Request type",
              type: "select",
              options: [
                "clarification",
                "change",
                "cancellation",
                "dispute",
                "refund",
              ].map((value) => ({ value, label: value })),
            },
            {
              name: "note",
              label: "Explain your request",
              type: "textarea",
              required: true,
            },
            {
              name: "paymentId",
              label: "Payment to refund (only for refund requests)",
              type: "select",
              options: [
                { value: "", label: "Not a refund request" },
                ...payments
                  .filter((p) =>
                    ["paid", "partially_refunded"].includes(p.status),
                  )
                  .map((p) => ({
                    value: p.id,
                    label: `${p.purpose} ${peso(Number(p.amount) - Number(p.refunded_amount))}`,
                  })),
              ],
            },
            {
              name: "amount",
              label: "Requested refund amount (if applicable)",
              type: "number",
              min: 0,
            },
          ]}
        />
        {requests.map((r) => (
          <article key={r.id}>
            <strong>
              {r.kind} - {r.status}
            </strong>
            <p>{r.note}</p>
            {r.decision_note && <p>MAZ response: {r.decision_note}</p>}
          </article>
        ))}
      </BookingSection>
      {finished && (
        <>
          <BookingSection title="Your MAZ company review" open={!review}>
            <p>
              This rates MAZ. Feedback about an individual worker is separate
              and private.
            </p>
            {review && !canEditCompanyReview(review.created_at) ? (
              <>
                <p>
                  {review.stars}/5 - {review.comment}
                </p>
                <p>The 14-day edit period has ended.</p>
              </>
            ) : (
              <ActionForm
                bookingId={id}
                action="company_review"
                label={review ? "Save MAZ review changes" : "Submit MAZ review"}
                fields={[
                  {
                    name: "stars",
                    label: "Your rating for MAZ",
                    type: "select",
                    required: true,
                    value: review?.stars ?? 5,
                    options: [1, 2, 3, 4, 5].map((value) => ({
                      value: String(value),
                      label: `${value} out of 5`,
                    })),
                  },
                  {
                    name: "note",
                    label: "Company review",
                    type: "textarea",
                    value: review?.comment ?? "",
                  },
                  {
                    name: "publish",
                    label: "I allow publication of my MAZ rating and review",
                    type: "checkbox",
                    value: review?.publish ?? false,
                  },
                  {
                    name: "attribution",
                    label: "Public attribution",
                    type: "select",
                    value: review?.attribution ?? "anonymous",
                    options: [
                      { value: "anonymous", label: "Anonymous" },
                      { value: "first_name", label: "First name only" },
                      {
                        value: "no_quote",
                        label: "Rating only, no review quote",
                      },
                    ],
                  },
                ]}
              />
            )}
          </BookingSection>
          <PrivateProviderFeedback bookingId={id} />
          <BookingSection
            title="Separate project-photo permission"
            open={false}
          >
            <p>
              Optional. This is separate from your review. MAZ must check photos
              for identifying details before publication. You may withdraw
              permission.
            </p>
            <ActionForm
              bookingId={id}
              action="portfolio_consent"
              label="Save photo permission"
              fields={[
                {
                  name: "allow",
                  label: "I allow MAZ to publish reviewed project photos",
                  type: "checkbox",
                  value: consent?.photos_allowed ?? false,
                },
              ]}
            />
          </BookingSection>
        </>
      )}
    </section>
  );
}
