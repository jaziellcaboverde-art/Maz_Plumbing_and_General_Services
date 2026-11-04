import Link from "next/link";
import { LinkButton } from "@/components/ui/link-button";
import { CalendarDays, Clock, RefreshCw, Users } from "lucide-react";
import { StatusBadge } from "@/components/booking/status-badge";
import detail from "./admin-detail.module.css";
import { BookingSection } from "./booking-section";
import { ActionLink } from "@/components/ui/action-link";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/layout/page-heading";
import { workflowSession } from "@/lib/workflow/session";
import { dayAndTime, peso } from "@/lib/matching/format";
import {
  AdminOperationForm,
  CheckoutReconcileForm,
} from "./admin-operation-form";
import styles from "./workflow.module.css";
import { AdminCreateBookingForm } from "./admin-create-booking-form";

export async function AdminAssignments() {
  const { client } = await workflowSession("admin");
  const { data, error } = await client
    .from("provider_assignments")
    .select(
      "id,booking_id,trade,phase,status,starts_at,ends_at,expires_at,response_note",
    )
    .in("status", [
      "offered",
      "accepted",
      "withdrawal_requested",
      "declined",
      "expired",
    ])
    .order("starts_at")
    .limit(100);
  return (
    <section className={styles.page}>
      <PageHeading
        title="Team assignments"
        description="Latest 100 offers and assignments. Workers must accept before confirmation."
        trailing={
          <ActionLink href="/admin/bookings">
            Offer roles from a booking
          </ActionLink>
        }
      />
      {error ? (
        <p role="alert">Could not load assignments.</p>
      ) : (
        <div className={styles.grid}>
          {data?.map((a) => (
            <article key={a.id} className={detail.card}>
              <div className={detail.assignmentHead}>
                <span className={detail.assignmentIcon}>
                  <Users aria-hidden="true" />
                </span>
                <div>
                  <h2>{a.trade}</h2>
                  <p>Booking {a.booking_id.slice(0, 8)}</p>
                </div>
                <StatusBadge status={a.status} />
              </div>
              <dl className={detail.facts}>
                <div>
                  <dt>Work phase</dt>
                  <dd>
                    {a.phase === "execution"
                      ? "Service work"
                      : a.phase.replaceAll("_", " ")}
                  </dd>
                </div>
                <div>
                  <dt>
                    <CalendarDays aria-hidden="true" />
                    Schedule
                  </dt>
                  <dd>
                    {dayAndTime(a.starts_at)}
                    <span className={detail.endTime}>
                      to {dayAndTime(a.ends_at)}
                    </span>
                  </dd>
                </div>
                {a.status === "offered" && (
                  <div>
                    <dt>
                      <Clock aria-hidden="true" />
                      Response deadline
                    </dt>
                    <dd>{dayAndTime(a.expires_at)}</dd>
                  </div>
                )}
              </dl>
              {a.response_note && (
                <p className={detail.decision}>{a.response_note}</p>
              )}
              <ActionLink href={`/admin/bookings/${a.booking_id}`}>
                Manage team
              </ActionLink>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
export async function AdminEvidence() {
  const { client } = await workflowSession("admin");
  const { data, error } = await client
    .from("provider_work_updates")
    .select("id,booking_id,kind,notes,created_at")
    .eq("review_status", "pending")
    .order("created_at")
    .limit(100);
  return (
    <section className={styles.page}>
      <PageHeading
        title="Work submissions"
        description="Review pending evidence before sharing progress or approving completion."
      />
      {error ? (
        <p role="alert">Could not load provider submissions.</p>
      ) : data?.length ? (
        <div className={styles.grid}>
          {data.map((u) => (
            <article key={u.id} className={styles.card}>
              <h2>{u.kind.replaceAll("_", " ")}</h2>
              <p>{u.notes}</p>
              <p>{dayAndTime(u.created_at)}</p>
              <ActionLink href={`/admin/bookings/${u.booking_id}`}>
                Review evidence
              </ActionLink>
            </article>
          ))}
        </div>
      ) : (
        <p>No provider evidence is awaiting review.</p>
      )}
    </section>
  );
}

export async function AdminQuotes() {
  const { client } = await workflowSession("admin");
  const [quotes, docs] = await Promise.all([
    client
      .from("quotes")
      .select("id,booking_id,version,status,amount,created_at,expires_at,bookings(id,description,manual_customer_name,services(name),profiles!bookings_customer_id_fkey(first_name,last_name))")
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("project_documents")
      .select("id,booking_id,kind,title,version,status,created_at,bookings(id,description,manual_customer_name,services(name),profiles!bookings_customer_id_fkey(first_name,last_name))")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  return (
    <section className={styles.page}>
      <PageHeading
        title="Quotations and agreements"
        description="Review each quotation and agreement with its customer and service details. Open the booking to prepare or update its quotation."
        trailing={<ActionLink href="/admin/bookings">Find a booking</ActionLink>}
      />
      {quotes.error || docs.error ? (
        <p role="alert">Could not load the quotation register.</p>
      ) : (
        <>
          <article className={styles.card}>
            <h2>Quotation versions</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Booking and customer</th>
                    <th>Version</th>
                    <th>Amount</th>
                    <th>Decision</th>
                    <th>Validity</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.data?.length ? quotes.data.map((q) => (
                    <tr key={q.id}>
                      <td>{(() => {
                        const booking = Array.isArray(q.bookings) ? q.bookings[0] : q.bookings;
                        const customer = booking?.profiles;
                        const profile = Array.isArray(customer) ? customer[0] : customer;
                        const name = booking?.manual_customer_name ??
                          (`${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "Customer");
                        const service = booking?.services;
                        const serviceName = (Array.isArray(service) ? service[0] : service)?.name ?? "Service request";
                        return <><ActionLink href={`/admin/bookings/${q.booking_id}`}>{name} - {serviceName}</ActionLink><span className={styles.reference}>Booking {q.booking_id.slice(0, 8)}{booking?.description ? ` - ${booking.description.slice(0, 120)}${booking.description.length > 120 ? "…" : ""}` : ""}</span></>;
                      })()}</td>
                      <td>{q.version}</td>
                      <td>{peso(Number(q.amount))}</td>
                      <td>{q.status}</td>
                      <td>
                        {q.expires_at
                          ? dayAndTime(q.expires_at)
                          : "Legacy quote"}
                      </td>
                    </tr>
                  )) : <tr><td colSpan={5}>No quotations have been issued yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </article>
          <article className={styles.card}>
            <h2>Agreements and change orders</h2>
            {docs.data?.length ? docs.data.map((d) => (
              <article key={d.id}>
                {(() => {
                  const booking = Array.isArray(d.bookings) ? d.bookings[0] : d.bookings;
                  const customer = booking?.profiles;
                  const profile = Array.isArray(customer) ? customer[0] : customer;
                  const name = booking?.manual_customer_name ??
                    (`${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "Customer");
                  const service = booking?.services;
                  const serviceName = (Array.isArray(service) ? service[0] : service)?.name ?? "Service request";
                  return <><h3><ActionLink href={`/admin/bookings/${d.booking_id}`}>{d.title}</ActionLink></h3><p>{name} - {serviceName} - Booking {d.booking_id.slice(0, 8)}</p>{booking?.description && <p>{booking.description.slice(0, 240)}{booking.description.length > 240 ? "…" : ""}</p>}<p>{d.kind.replaceAll("_", " ")} v{d.version} - {d.status}</p></>;
                })()}
              </article>
            )) : <p>No agreements or change orders have been issued yet.</p>}
          </article>
        </>
      )}
    </section>
  );
}
export async function AdminPayments() {
  const { client } = await workflowSession("admin");
  const [claims, requests, payments] = await Promise.all([
    client
      .from("manual_payment_claims")
      .select("id,booking_id,method,amount,status,reference,created_at")
      .eq("status", "pending")
      .order("created_at")
      .limit(100),
    client
      .from("booking_requests")
      .select("id,booking_id,kind,note,amount,status,created_at")
      .in("status", ["requested", "approved"])
      .order("created_at")
      .limit(100),
    client
      .from("payments")
      .select(
        "id,booking_id,purpose,amount,processing_fee,refunded_amount,status,manual_channel,created_at,checkout_session_id,gateway_checkout_claimed_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  return (
    <section className={styles.page}>
      <PageHeading
        title="Payments, requests and refunds"
        description="Verify payments and review requests. Latest 100 records per list."
      />
      {claims.error || requests.error || payments.error ? (
        <p role="alert">Could not load payment operations.</p>
      ) : (
        <>
          <div className={styles.grid}>
            <article className={styles.card}>
              <h2>Manual funds awaiting verification</h2>
              {claims.data?.length ? (
                claims.data.map((c) => (
                  <p key={c.id}>
                    <ActionLink href={`/admin/bookings/${c.booking_id}`}>
                      {c.booking_id.slice(0, 8)} - {c.method}{" "}
                      {peso(Number(c.amount))}
                    </ActionLink>{" "}
                    - {c.reference}
                  </p>
                ))
              ) : (
                <p>No pending manual claims.</p>
              )}
            </article>
            <article className={styles.card}>
              <h2>Customer requests</h2>
              {requests.data?.length ? (
                requests.data.map((r) => (
                  <article key={r.id}>
                    <ActionLink href={`/admin/bookings/${r.booking_id}`}>
                      {r.kind} - {r.booking_id.slice(0, 8)}
                    </ActionLink>
                    <p>
                      {r.status}
                      {r.amount ? ` - ${peso(Number(r.amount))}` : ""}: {r.note}
                    </p>
                  </article>
                ))
              ) : (
                <p>No open requests.</p>
              )}
            </article>
          </div>
          <article className={styles.card}>
            <h2>Payment register</h2>
            <p>Reconcile interrupted checkouts before charging again.</p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Purpose</th>
                    <th>Principal</th>
                    <th>Processing fee</th>
                    <th>Refunded principal</th>
                    <th>State / channel</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.data?.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <ActionLink href={`/admin/bookings/${p.booking_id}`}>
                          {p.booking_id.slice(0, 8)}
                        </ActionLink>
                      </td>
                      <td>{p.purpose}</td>
                      <td>{peso(Number(p.amount))}</td>
                      <td>{peso(Number(p.processing_fee))}</td>
                      <td>{peso(Number(p.refunded_amount))}</td>
                      <td>
                        {p.status} / {p.manual_channel ?? "PayMongo"}
                        {p.status === "pending" &&
                        p.gateway_checkout_claimed_at &&
                        !p.checkout_session_id
                          ? " - checkout needs reconciliation"
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {payments.data
              ?.filter((p) => p.status === "pending" && !p.manual_channel)
              .map((p) => (
                <details key={p.id}>
                  <summary>Reconcile payment {p.id.slice(0, 8)}</summary>
                  <CheckoutReconcileForm
                    paymentId={p.id}
                    sessionId={p.checkout_session_id}
                  />
                </details>
              ))}
          </article>
        </>
      )}
    </section>
  );
}
export async function AdminConfiguration() {
  const { client } = await workflowSession("admin");
  const [services, instructions] = await Promise.all([
    client
      .from("services")
      .select("id,name,inspection_policy,inspection_due_point")
      .eq("active", true)
      .order("name"),
    client.from("maz_payment_instructions").select("*"),
  ]);
  return (
    <section className={styles.page}>
      <PageHeading
        title="Business configuration"
        description="Manage inspection rules and official payment instructions."
      />
      {services.error || instructions.error ? (
        <p role="alert">Could not load business configuration.</p>
      ) : (
        <>
          <BookingSection title="Official MAZ payment instructions">
            <p>Use verified company collection accounts.</p>
            <div className={styles.grid}>
              {["cash", "gcash", "bank"].map((method) => (
                <article className={styles.card} key={method}>
                  <h3>
                    {
                      { cash: "Cash", gcash: "GCash", bank: "Bank transfer" }[
                        method
                      ]
                    }
                  </h3>
                  <AdminOperationForm
                    operation="instructions"
                    label="Save verified instructions"
                    values={{ method }}
                    fields={[
                      {
                        name: "instructions",
                        label: "Company account / collection instructions",
                        type: "textarea",
                        required: true,
                        value:
                          instructions.data?.find((i) => i.method === method)
                            ?.instructions ?? "",
                      },
                    ]}
                  />
                </article>
              ))}
            </div>
          </BookingSection>
          <BookingSection title="Selected-service inspection rules">
            <p>
              Chargeable inspections cost PHP 1,500, credited once toward the
              project. Changes apply to new requests.
            </p>
            <div className={styles.policyGrid}>
              {services.data?.map((s) => (
                <article key={s.id} className={styles.card}>
                  <h3>{s.name}</h3>
                  <AdminOperationForm
                    operation="service"
                    values={{ serviceId: s.id }}
                    label="Save policy"
                    fields={[
                      {
                        name: "policy",
                        label: "Inspection requirement",
                        type: "select",
                        value: s.inspection_policy,
                        options: [
                          { value: "not_required", label: "Not required" },
                          { value: "free", label: "Required, no charge" },
                          { value: "chargeable", label: "Required, PHP 1,500" },
                        ],
                      },
                      {
                        name: "due",
                        label: "Inspection payment due point",
                        type: "select",
                        value: s.inspection_due_point,
                        options: [
                          {
                            value: "admin_agreed",
                            label: "As agreed with MAZ",
                          },
                          {
                            value: "before_visit",
                            label: "Before the inspection visit",
                          },
                        ],
                      },
                    ]}
                  />
                </article>
              ))}
            </div>
          </BookingSection>
          <article className={styles.card}>
            <h2>Owner decisions</h2>
            <p>
              MAZ decides project deposits, cancellation charges and refunds.
              Record each decision and settlement reference in the booking.
            </p>
            <ActionLink href="/admin/services">
              Manage service catalog
            </ActionLink>
          </article>
        </>
      )}
    </section>
  );
}
export async function AdminCreateBooking() {
  const { client } = await workflowSession("admin");
  const [customers, addresses, services] = await Promise.all([
    client
      .from("profiles")
      .select("id,first_name,last_name,mobile")
      .eq("role", "customer")
      .order("first_name"),
    client
      .from("addresses")
      .select("id,profile_id,line1,city")
      .not("location", "is", null),
    client.from("services").select("id,name").eq("active", true).order("name"),
  ]);
  return (
    <section className={styles.page}>
      <PageHeading
        title="Create booking"
        description="Record service details for a customer who contacted MAZ by phone, Facebook, walk-in or referral."
      />
      {customers.error || addresses.error || services.error ? (
        <p role="alert">Could not load intake options.</p>
      ) : (
        <article className={styles.card}>
          <p className={styles.intakeIntro}>
            Enter the customer&apos;s contact and service details directly, or link
            the request to an existing customer account. New requests need MAZ
            review before the appointment or coverage is confirmed.
          </p>
          <AdminCreateBookingForm
            customers={(customers.data ?? []).map((c) => ({
              value: c.id,
              label: `${c.first_name ?? "Customer"} ${c.last_name ?? ""} - ${c.mobile ?? c.id.slice(0, 8)}`,
            }))}
            addresses={(addresses.data ?? []).map((a) => {
              const c = customers.data?.find((c) => c.id === a.profile_id);
              return {
                value: a.id,
                label: `${c?.first_name ?? "Customer"} ${c?.last_name ?? ""}: ${a.line1}, ${a.city}`,
              };
            })}
            services={(services.data ?? []).map((s) => ({
              value: s.id,
              label: s.name,
            }))}
          />
        </article>
      )}
    </section>
  );
}
export async function AdminPortfolio() {
  const { client } = await workflowSession("admin");
  const [entries, reviews] = await Promise.all([
    client
      .from("project_portfolio_entries")
      .select(
        "id,booking_id,title,description,published,created_at,bookings(service_id)",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("company_reviews")
      .select(
        "id,booking_id,stars,comment,publish,hidden,attribution,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  return (
    <section className={styles.page}>
      <PageHeading
        title="Project portfolio and company reviews"
        description="Publish approved photos and reviews with customer permission. Latest 100 records."
        trailing={
          <Link href="/admin/bookings?status=Completed">
            Select completed project
          </Link>
        }
      />
      {entries.error || reviews.error ? (
        <p role="alert">Could not load publication controls.</p>
      ) : (
        <>
          <article className={styles.card}>
            <h2>Reviewed project entries</h2>
            <p>
              Publish completed provider work from its booking after customer
              consent. Published projects appear in that service’s portfolio for
              visitors and customers.
            </p>
            <div className={styles.actions}>
              <LinkButton href="/admin/services#service-portfolio">
                Manage service photos
              </LinkButton>
              <LinkButton
                href="/#services"
                target="_blank"
                rel="noopener noreferrer"
              >
                View public services
              </LinkButton>
            </div>
            {entries.data?.length ? (
              entries.data.map((e) => (
                <article className={styles.card} key={e.id}>
                  <h3>
                    <Link href={`/admin/bookings/${e.booking_id}`}>
                      {e.title}
                    </Link>
                  </h3>
                  <p>{e.description}</p>
                  {(() => {
                    const booking = Array.isArray(e.bookings)
                      ? e.bookings[0]
                      : e.bookings;
                    return booking?.service_id ? (
                      <div className={styles.actions}>
                        <LinkButton
                          href={`/services/${booking.service_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Preview service portfolio
                        </LinkButton>
                        <LinkButton
                          href={`/admin/services?portfolio=${booking.service_id}#service-portfolio`}
                        >
                          Manage service photos
                        </LinkButton>
                      </div>
                    ) : null;
                  })()}
                  <p>
                    {e.published
                      ? "Published, subject to current consent"
                      : "Unpublished"}
                  </p>
                  {e.published && (
                    <AdminOperationForm
                      operation="moderate"
                      values={{ kind: "portfolio", id: e.id, hide: true }}
                      label="Unpublish project"
                      fields={[
                        {
                          name: "note",
                          label: "Privacy / withdrawal reason",
                          type: "textarea",
                          required: true,
                        },
                      ]}
                    />
                  )}
                </article>
              ))
            ) : (
              <p>No reviewed projects published yet.</p>
            )}
          </article>
          <article className={styles.card}>
            <h2>Company reviews</h2>
            <p>
              Customer publication permission is required even if MAZ clears a
              moderation hold. Private worker feedback is excluded.
            </p>
            {reviews.data?.map((r) => (
              <article className={styles.card} key={r.id}>
                <Link href={`/admin/bookings/${r.booking_id}`}>
                  Booking {r.booking_id.slice(0, 8)}
                </Link>
                <p>
                  {r.stars}/5 - {r.comment}
                </p>
                <p>
                  Customer publication: {r.publish ? "Allowed" : "Private"}.
                  Attribution: {r.attribution}. Moderation:{" "}
                  {r.hidden ? "Hidden" : "Clear"}.
                </p>
                <AdminOperationForm
                  operation="moderate"
                  values={{ kind: "review", id: r.id, hide: !r.hidden }}
                  label={
                    r.hidden
                      ? "Clear moderation hold"
                      : "Hide from public reviews"
                  }
                  fields={[
                    {
                      name: "note",
                      label: "Moderation reason",
                      type: "textarea",
                      required: true,
                    },
                  ]}
                />
              </article>
            ))}
          </article>
        </>
      )}
    </section>
  );
}
export async function AdminReports({
  from,
  to,
}: {
  from?: string;
  to?: string;
}) {
  const { client } = await workflowSession("admin");
  const start =
      from && /^\d{4}-\d{2}-\d{2}$/.test(from)
        ? `${from}T00:00:00+08:00`
        : null,
    end = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59+08:00` : null;
  const { data, error } = await client.rpc("managed_operations_report", {
    p_from: start,
    p_to: end,
  });
  return (
    <section className={styles.page}>
      <PageHeading
        title="Operations and project finances"
        description="Bookings submitted within the chosen Philippine dates, with their current verified financial position. This is a project report, not a tax receipt or cash-flow statement."
      />
      <form className={`${styles.card} ${styles.form} ${styles.reportFilters}`}>
        <label>
          Submitted from
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          Submitted through
          <input type="date" name="to" defaultValue={to} />
        </label>
        <Button type="submit" variant="primary">
          <RefreshCw aria-hidden="true" />
          Update report
        </Button>
      </form>
      {error ? (
        <p role="alert">Could not load the report. Check the date range.</p>
      ) : (
        data && (
          <>
            <div className={styles.grid}>
              {[
                ["Requests", data.bookings],
                ["MAZ-completed projects", data.completed],
                ["Cancelled requests", data.cancelled],
                [
                  "Approved gross, excluding cancelled",
                  peso(Number(data.approved_gross)),
                ],
                [
                  "Net verified principal, after refunds",
                  peso(Number(data.net_verified)),
                ],
                [
                  "Service receivable, excluding cancelled",
                  peso(Number(data.service_receivable)),
                ],
              ].map(([label, value]) => (
                <article className={styles.card} key={label}>
                  <h2>{label}</h2>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>
            <article className={styles.card}>
              <h2>By official status</h2>
              {data.by_status.map((s: { status: string; count: number }) => (
                <p key={s.status}>
                  {s.status}: {s.count}
                </p>
              ))}
            </article>
            <article className={styles.card}>
              <h2>By service</h2>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Requests</th>
                      <th>Completed</th>
                      <th>Net verified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_service.map(
                      (s: {
                        service: string;
                        bookings: number;
                        completed: number;
                        net_verified: number;
                      }) => (
                        <tr key={s.service}>
                          <td>{s.service}</td>
                          <td>{s.bookings}</td>
                          <td>{s.completed}</td>
                          <td>{peso(Number(s.net_verified))}</td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </article>
            <p>
              Gross totals include accepted change orders. Net principal
              includes legacy cash and verified gateway/manual payments, less
              settled principal refunds. Processing fees are excluded.
              Inspection principal is counted once. Cancelled projects remain
              visible for payment reconciliation.
            </p>
          </>
        )
      )}
    </section>
  );
}
