import { timingSafeEqual } from "node:crypto";
import { runNotificationRetryWorker } from "@/lib/notifications/retry";

function isAuthorized(request: Request) {
  const expected = process.env.NOTIFICATION_WORKER_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runNotificationRetryWorker();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification worker failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
