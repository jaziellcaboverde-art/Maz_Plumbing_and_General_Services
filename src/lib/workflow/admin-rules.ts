import { z } from "zod";
const id = z.string().uuid();
export const adminOperations = {
  service: z.object({
    serviceId: id,
    policy: z.enum(["not_required", "free", "chargeable"]),
    due: z.enum(["admin_agreed", "before_visit"]),
  }),
  instructions: z.object({
    method: z.enum(["cash", "gcash", "bank"]),
    instructions: z.string().trim().min(10).max(2000),
  }),
  create: z.union([
    z.object({
      customerId: id,
      serviceId: id,
      addressId: id,
      description: z.string().trim().min(10).max(4000),
      start: z.string().datetime(),
      source: z.enum(["phone", "facebook", "walk_in", "referral"]),
    }),
    z.object({
      customerName: z.string().trim().min(2).max(160),
      customerMobile: z.string().trim().min(7).max(32),
      customerAddress: z.string().trim().min(8).max(500),
      serviceId: id,
      description: z.string().trim().min(10).max(4000),
      start: z.string().datetime(),
      source: z.enum(["phone", "facebook", "walk_in", "referral"]),
    }),
  ]),
  moderate: z.object({
    kind: z.enum(["review", "portfolio"]),
    id,
    hide: z.boolean(),
    note: z.string().trim().min(10).max(2000),
  }),
};
export type AdminOperation = keyof typeof adminOperations;
