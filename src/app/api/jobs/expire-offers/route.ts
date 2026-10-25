import { processExpiredOffers } from "@/lib/matching/engine";

/**
 * Worker: closes offers that ran out of time and offers the job on. Screens also do this when
 * they open, so the worker only makes sure nothing waits when nobody is looking.
 * Call it every minute or two with the header `Authorization: Bearer <CRON_SECRET>`
 * (a Vercel Cron job on a paid plan, or any free scheduler such as cron-job.org).
 */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  try {
    const closed = await processExpiredOffers();
    return Response.json({ ok: true, closed });
  } catch (error) {
    console.error("expire-offers failed", error);
    return Response.json({ error: "Could not close timed out offers." }, { status: 503 });
  }
}

export const GET = run;
export const POST = run;
