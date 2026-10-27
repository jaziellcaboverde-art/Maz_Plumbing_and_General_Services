import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseWebhookEvent, signatureMatches } from "../src/lib/payments/webhook";

const hmac = (data: string, key: string) => createHmac("sha256", key).update(data).digest("hex");
const equal = (a: Buffer, b: Buffer) => a.equals(b);
const SECRET = "whsk_test";
const body = JSON.stringify({ data: { attributes: { type: "checkout_session.payment.paid", data: { id: "cs_1", attributes: {
  metadata: { payment_id: "pay-1" }, payments: [{ id: "pay_x", attributes: { source: { type: "paymaya" } } }] } } } } });
const sign = (raw: string, t = "1700000000") => `t=${t},te=${hmac(`${t}.${raw}`, SECRET)},li=`;

describe("PayMongo webhook (9.11)", () => {
  test("a correct test signature passes", () => expect(signatureMatches(body, sign(body), SECRET, hmac, equal)).toBe(true));
  test("a live signature passes too", () => {
    const header = `t=5,te=,li=${hmac(`5.${body}`, SECRET)}`;
    expect(signatureMatches(body, header, SECRET, hmac, equal)).toBe(true);
  });
  test("a changed body, wrong secret, or missing header is refused", () => {
    expect(signatureMatches(body + " ", sign(body), SECRET, hmac, equal)).toBe(false);
    expect(signatureMatches(body, sign(body), "other", hmac, equal)).toBe(false);
    expect(signatureMatches(body, null, SECRET, hmac, equal)).toBe(false);
    expect(signatureMatches(body, "garbage", SECRET, hmac, equal)).toBe(false);
  });
  test("a paid checkout becomes a paid outcome with the Maya method", () => {
    expect(parseWebhookEvent(JSON.parse(body))).toEqual({ paid: true, paymentId: "pay-1", paymongoPaymentId: "pay_x", method: "maya", reason: null });
  });
  test("a failed payment becomes a failed outcome", () => {
    const event = { data: { attributes: { type: "payment.failed", data: { id: "pay_y", attributes: { metadata: { payment_id: "pay-2" }, failed_message: "Card declined", source: { type: "card" } } } } } };
    expect(parseWebhookEvent(event)).toMatchObject({ paid: false, paymentId: "pay-2", reason: "Card declined", method: "card" });
  });
  test("events we do not act on, or without our payment id, are ignored", () => {
    expect(parseWebhookEvent({ data: { attributes: { type: "source.chargeable", data: {} } } })).toBeNull();
    expect(parseWebhookEvent({ data: { attributes: { type: "payment.paid", data: { attributes: {} } } } })).toBeNull();
    expect(parseWebhookEvent(null)).toBeNull();
  });
});

describe("deposit migration (9.9 to 9.16)", () => {
  const sql = readFileSync("supabase/migrations/20261027200000_deposit_payments.sql", "utf8");
  test("a repeat of a paid payment changes nothing", () => {
    expect(sql).toMatch(/if v_payment\.status = 'paid' then\s+return jsonb_build_object\('changed', false/);
  });
  test("only the server can apply a payment result", () => {
    expect(sql).toMatch(/revoke all on function public\.apply_payment_result[^;]*from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.apply_payment_result[^;]*to service_role/);
  });
  test("paying moves the booking to deposit_paid and issues an acknowledgment", () => {
    expect(sql).toContain("'deposit_paid'");
    expect(sql).toContain("insert into public.receipts");
  });
});
