export type DeliveryFailureTransition = {
  status: "pending" | "failed";
  nextAttemptAt: string;
};

/** Three total attempts: the first send plus two retries five minutes apart. */
export function deliveryFailureTransition(attempts: number, now = Date.now()): DeliveryFailureTransition {
  const isFinalAttempt = attempts >= 3;
  return {
    status: isFinalAttempt ? "failed" : "pending",
    nextAttemptAt: new Date(now + (isFinalAttempt ? 0 : 5 * 60 * 1000)).toISOString(),
  };
}
