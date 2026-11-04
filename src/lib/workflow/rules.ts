import { z } from "zod";

const text = z.string().trim().min(3).max(4000);
const note = z.string().trim().min(10).max(4000);
const money = z.number().finite().min(0).max(10000000);
const uuid = z.string().uuid();
export const workflowSchemas = {
  admin_review: z.object({
    decision: z.enum(["accept", "clarify", "decline"]),
    note: text,
    inspectionRequired: z.boolean(),
    chargeInspection: z.boolean(),
    payInspectionBeforeVisit: z.boolean(),
    contractRequired: z.boolean(),
  }),
  admin_quote: z.object({
    note,
    items: z
      .array(
        z.object({
          description: text,
          quantity: z.number().positive().max(100000),
          unitPrice: money,
        }),
      )
      .min(1)
      .max(30),
    deposit: money,
    gatewayFee: money,
    expiresAt: z.string().datetime(),
    schedule: z
      .array(
        z.object({
          label: text,
          amount: money.positive(),
          dueAt: z.string().datetime().nullable(),
          milestoneId: uuid.nullable(),
        }),
      )
      .max(20)
      .default([]),
  }),
  respond_quote: z.object({
    id: uuid,
    version: z.number().int().positive(),
    accept: z.boolean(),
    note: z.string().max(2000).optional(),
  }),
  admin_record_quote_decision: z.object({
    id: uuid,
    version: z.number().int().positive(),
    accept: z.boolean(),
    note,
  }),
  admin_document: z.object({
    kind: z.enum(["contract", "change_order"]),
    title: text,
    note,
    costDelta: money,
    daysDelta: z.number().int().min(0).max(3650),
  }),
  respond_document: z.object({
    id: uuid,
    version: z.number().int().positive(),
    accept: z.boolean(),
  }),
  admin_record_document_decision: z.object({
    id: uuid,
    version: z.number().int().positive(),
    accept: z.boolean(),
    note,
  }),
  manual_payment: z.object({
    purpose: z.enum(["inspection", "deposit", "milestone", "balance"]),
    amount: money.positive(),
    method: z.enum(["cash", "gcash", "bank"]),
    reference: text,
    proofPath: z.string().max(400).nullable(),
    key: uuid,
  }),
  admin_verify_payment: z.object({
    id: uuid,
    approve: z.boolean(),
    note: text,
  }),
  customer_request: z.object({
    kind: z.enum([
      "cancellation",
      "clarification",
      "change",
      "dispute",
      "refund",
    ]),
    note,
    amount: money.positive().nullable().optional(),
    paymentId: uuid.nullable().optional(),
    key: uuid,
  }),
  admin_resolve_request: z.object({ id: uuid, approve: z.boolean(), note }),
  admin_record_refund: z.object({ id: uuid, reference: text, note }),
  turnover: z.object({ note: z.string().max(4000) }),
  admin_start: z.object({}),
  admin_finish: z.object({}),
  admin_close: z.object({}),
  company_review: z.object({
    stars: z.number().int().min(1).max(5),
    note: z.string().max(2000),
    publish: z.boolean(),
    attribution: z.enum(["anonymous", "first_name", "no_quote"]),
  }),
  portfolio_consent: z.object({ allow: z.boolean() }),
  admin_publish: z.object({
    title: text,
    note,
    privacyChecked: z.literal(true),
    photos: z.array(z.string().max(400)).min(1).max(10),
  }),
} as const;
export type WorkflowAction = keyof typeof workflowSchemas;
export function parseWorkflowAction(action: unknown, data: unknown) {
  if (typeof action !== "string" || !Object.hasOwn(workflowSchemas, action))
    return null;
  const parsed = workflowSchemas[action as WorkflowAction].safeParse(data);
  if (!parsed.success) return null;
  if (
    action === "customer_request" &&
    "kind" in parsed.data &&
    parsed.data.kind === "refund" &&
    (!("amount" in parsed.data) ||
      !parsed.data.amount ||
      !("paymentId" in parsed.data) ||
      !parsed.data.paymentId)
  )
    return null;
  return { action: action as WorkflowAction, data: parsed.data };
}
export function remainingBalance(total: number, paid: number) {
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}
export function canEditCompanyReview(createdAt: string, now = new Date()) {
  return now.getTime() <= new Date(createdAt).getTime() + 14 * 86400000;
}
