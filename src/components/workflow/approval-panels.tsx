import { peso, dayAndTime } from "@/lib/matching/format";
import type { ProjectDocument, WorkflowQuote } from "@/lib/workflow/load";
import {
  quotationStatus,
  type bookingApprovalState,
} from "@/lib/workflow/approval-state";
import { InlineAction } from "./inline-action";
import { ProjectDocumentForm } from "./project-document-form";
import { QuoteBuilder } from "./quote-builder";
import { ActionForm } from "./action-form";
import detail from "./admin-detail.module.css";
import styles from "./workflow.module.css";
import approval from "./approval.module.css";

export function ApprovalPanels({
  bookingId,
  state,
  quotes,
  documents,
  milestones,
  active,
  manualCustomer,
  canQuote,
  inspectionCredit,
  contractRequired = false,
}: {
  bookingId: string;
  state: ReturnType<typeof bookingApprovalState>;
  quotes: WorkflowQuote[];
  documents: ProjectDocument[];
  milestones: { id: string; title: string }[];
  active: boolean;
  manualCustomer: boolean;
  canQuote: boolean;
  inspectionCredit: number;
  contractRequired?: boolean;
}) {
  const current = state.currentQuote;
  const contracts = documents.filter((d) => d.kind === "contract"),
    changes = documents.filter((d) => d.kind === "change_order");
  return (
    <div className={approval.sections}>
      <section className={detail.card} aria-label="Quotation">
        <h2>Quotation</h2>
        {current ? (
          <>
            <div className={approval.heading}>
              <h3>Quotation #{current.version}</h3>
              <span
                className={approval.status}
                data-approved={current.status === "accepted"}
              >
                {quotationStatus(current.status)}
              </span>
            </div>
            <dl className={detail.facts}>
              <div>
                <dt>Total</dt>
                <dd>{peso(Number(current.amount))}</dd>
              </div>
              <div>
                <dt>
                  {Number(current.deposit_amount ?? 0) > 0
                    ? "Down payment"
                    : "Full payment (100%)"}
                </dt>
                <dd>
                  {peso(
                    Number(current.deposit_amount ?? 0) > 0
                      ? Number(current.deposit_amount)
                      : Number(current.amount),
                  )}
                </dd>
              </div>
              <div>
                <dt>Balance after completion</dt>
                <dd>
                  {peso(
                    Math.max(
                      0,
                      Number(current.amount) -
                        Number(current.deposit_amount ?? 0),
                    ),
                  )}
                </dd>
              </div>
              {current.status === "accepted" && (
                <div>
                  <dt>Approved date</dt>
                  <dd>
                    {current.accepted_at
                      ? dayAndTime(current.accepted_at)
                      : "Not recorded"}
                  </dd>
                </div>
              )}
            </dl>
            <QuoteDetails quote={current} inspectionCredit={inspectionCredit} />
            {manualCustomer && current.status === "approved" && (
              <OfflineDecision bookingId={bookingId} record={current} quote />
            )}
          </>
        ) : (
          <p>No quotation yet.</p>
        )}
        {active &&
          !state.accepted &&
          (canQuote ? (
            <InlineAction
              label={
                current ? "Prepare quotation revision" : "Create quotation"
              }
            >
              <QuoteBuilder
                bookingId={bookingId}
                contractRequired={contractRequired}
                milestones={milestones}
                initialQuote={current}
              />
            </InlineAction>
          ) : (
            <p>
              Accept the request and review any required inspection findings
              before preparing the final quotation.
            </p>
          ))}
        {quotes.some((q) => q.id !== current?.id) && (
          <details className={approval.details}>
            <summary>Previous quotation versions</summary>
            {quotes
              .filter((q) => q.id !== current?.id)
              .map((q) => (
                <article key={q.id}>
                  <h3>
                    Quotation #{q.version} · {quotationStatus(q.status)}
                  </h3>
                  <QuoteDetails quote={q} inspectionCredit={0} />
                </article>
              ))}
          </details>
        )}
      </section>
      <section className={detail.card} aria-label="Contract">
        <div className={approval.heading}>
          <h2>Contract</h2>
          <span
            className={approval.status}
            data-approved={!!state.approvedContract}
          >
            {state.contractState}
          </span>
        </div>
        <p>
          {state.approvedContract
            ? "Customer has approved the contract."
            : state.contractState === "Contract Not Required"
              ? "This service does not require a separate contract."
              : state.pendingContract
                ? "The contract is awaiting customer approval."
                : "Prepare and send the service contract for customer approval."}
        </p>
        {contracts.map((document) => (
          <DocumentDetails
            key={document.id}
            document={document}
            bookingId={bookingId}
            manualCustomer={manualCustomer}
          />
        ))}
        {active &&
          contractRequired &&
          state.accepted &&
          !state.approvedContract && (
            <InlineAction
              label={
                state.pendingContract
                  ? "Prepare contract revision"
                  : "Create Contract"
              }
            >
              <ProjectDocumentForm
                bookingId={bookingId}
                quotation={state.accepted}
                kind="contract"
              />
            </InlineAction>
          )}
        {!state.accepted && state.contractState !== "Contract Not Required" && (
          <p>Issue the MAZ quotation first.</p>
        )}
      </section>
      <section className={detail.card} aria-label="Additional work">
        <h2>
          Additional Work <small className={styles.muted}>(optional)</small>
        </h2>
        {!changes.length && <p>No additional work requests.</p>}
        {changes.map((document) => (
          <DocumentDetails
            key={document.id}
            document={document}
            bookingId={bookingId}
            manualCustomer={manualCustomer}
          />
        ))}
        {active && state.accepted && (
          <InlineAction label="Request Extra Work Approval">
            <ProjectDocumentForm
              bookingId={bookingId}
              quotation={state.accepted}
              kind="change_order"
            />
          </InlineAction>
        )}
        <p className={styles.muted}>
          Only needed for changes to approved scope, cost or duration. A
          declined request leaves the approved scope unchanged.
        </p>
      </section>
    </div>
  );
}
function QuoteDetails({
  quote: q,
  inspectionCredit,
}: {
  quote: WorkflowQuote;
  inspectionCredit: number;
}) {
  return (
    <details className={approval.details}>
      <summary>View Quotation Details</summary>
      <div className={approval.sections}>
        <p className={styles.document}>{q.notes}</p>
        {!!q.line_items.length && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Labor / material</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {q.line_items.map((i, n) => (
                  <tr key={n}>
                    <td>{i.description}</td>
                    <td>{i.quantity}</td>
                    <td>{peso(Number(i.unitPrice))}</td>
                    <td>
                      {peso(
                        Math.round(
                          Number(i.quantity) * Number(i.unitPrice) * 100,
                        ) / 100,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={3}>Subtotal</th>
                  <td>
                    {peso(
                      q.line_items.reduce(
                        (sum, i) =>
                          sum +
                          Math.round(
                            Number(i.quantity) * Number(i.unitPrice) * 100,
                          ) /
                            100,
                        0,
                      ),
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p>Total: {peso(Number(q.amount))}</p>
        {inspectionCredit > 0 && (
          <p>
            Inspection credit: {peso(inspectionCredit)}, already included in
            verified payments. Applied once toward the service balance.
          </p>
        )}
        <p>
          Required before work: {peso(Number(q.deposit_amount ?? 0))}. Previous
          verified payments count toward this requirement.
        </p>
        {!!q.payment_schedule?.length && (
          <ul>
            {q.payment_schedule.map((i, n) => (
              <li key={n}>
                {i.label}: {peso(Number(i.amount))}
                {i.dueAt ? ` · ${dayAndTime(i.dueAt)}` : ""}
                {i.milestoneId ? " · After milestone approval" : ""}
              </li>
            ))}
          </ul>
        )}
        {q.expires_at && <p>Validity: {dayAndTime(q.expires_at)}</p>}
        {q.decision_note && <p>Decision: {q.decision_note}</p>}
      </div>
    </details>
  );
}
function DocumentDetails({
  document: d,
  bookingId,
  manualCustomer,
}: {
  document: ProjectDocument;
  bookingId: string;
  manualCustomer: boolean;
}) {
  return (
    <details className={approval.details}>
      <summary>
        {d.title} · v{d.version} ·{" "}
        {d.status === "accepted"
          ? "Customer Approved"
          : d.status === "issued"
            ? "Awaiting Customer Approval"
            : d.status.replaceAll("_", " ")}
      </summary>
      <p className={styles.document}>{d.body}</p>
      {d.kind === "change_order" && (
        <p>
          Additional cost: {peso(Number(d.cost_delta))} · Additional days:{" "}
          {d.days_delta}
        </p>
      )}
      {d.decided_at && <p>Decision recorded: {dayAndTime(d.decided_at)}</p>}
      {d.decision_note && <p>Customer decision: {d.decision_note}</p>}
      {manualCustomer && d.status === "issued" && (
        <OfflineDecision bookingId={bookingId} record={d} />
      )}
    </details>
  );
}
function OfflineDecision({
  bookingId,
  record,
  quote = false,
}: {
  bookingId: string;
  record: { id: string; version: number };
  quote?: boolean;
}) {
  return (
    <InlineAction label="Record offline customer decision">
      <ActionForm
        bookingId={bookingId}
        action={
          quote
            ? "admin_record_quote_decision"
            : "admin_record_document_decision"
        }
        values={{ id: record.id, version: record.version }}
        label="Save customer decision"
        fields={[
          {
            name: "accept",
            label: "Customer approved this version",
            type: "checkbox",
            value: true,
          },
          {
            name: "note",
            label: "Confirmation details (call, message or signed copy)",
            type: "textarea",
            required: true,
          },
        ]}
      />
    </InlineAction>
  );
}
