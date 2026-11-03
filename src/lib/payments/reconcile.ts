import "server-only";
import { toCentavos } from "./paymongo";
type RemotePayment = {
  id: string;
  attributes: {
    status: string;
    currency: string;
    amount: number;
    source?: { type?: string };
  };
};
/** Read-only recovery: retrieves an existing checkout; never creates another charge. */
export async function retrieveExpectedCheckout(
  sessionId: string,
  paymentId: string,
  amount: number,
) {
  const secret = process.env.PAYMONGO_SECRET_KEY?.trim();
  if (!secret || !/^cs_[A-Za-z0-9]+$/.test(sessionId))
    throw Error("Valid checkout reference and configured gateway required");
  const response = await fetch(
    `https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
      },
      cache: "no-store",
    },
  );
  const json = await response.json(),
    a = json?.data?.attributes;
  if (
    !response.ok ||
    json?.data?.id !== sessionId ||
    (a?.metadata?.payment_id ?? a?.reference_number) !== paymentId
  )
    throw Error("Checkout identity mismatch");
  const paid = (a.payments ?? []).filter(
    (p: RemotePayment) => p.attributes?.status === "paid",
  ) as RemotePayment[];
  if (paid.length > 1)
    throw Error(
      "Multiple successful payments require gateway support reconciliation",
    );
  if (paid.length === 1) {
    if (
      paid[0].attributes.currency !== "PHP" ||
      paid[0].attributes.amount !== toCentavos(amount)
    )
      throw Error("Paid amount mismatch");
    return { status: "paid", payment: paid[0], url: a.checkout_url as string };
  }
  const items = a.line_items as {
    amount: number;
    quantity: number;
    currency: string;
  }[];
  if (
    !Array.isArray(items) ||
    !items.length ||
    items.some((i) => i.currency !== "PHP") ||
    items.reduce((sum, i) => sum + i.amount * i.quantity, 0) !==
      toCentavos(amount)
  )
    throw Error("Checkout line item amount mismatch");
  if (a.status !== "active" && a.status !== "expired")
    throw Error("Checkout requires gateway support reconciliation");
  const url = new URL(a.checkout_url);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".paymongo.com"))
    throw Error("Invalid hosted checkout URL");
  return {
    status: a.status as "active" | "expired",
    payment: null,
    url: url.toString(),
  };
}
