import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, context: RouteContext<"/api/location/arrival/override/[requestId]">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to review this request." }, { status: 401 });
  const { requestId } = await context.params;
  let body: { approve?: unknown; reason?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Choose approve or decline." }, { status: 400 }); }
  if (typeof body.approve !== "boolean") return NextResponse.json({ error: "Choose approve or decline." }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim() : null;
  const { error } = await supabase.rpc("review_arrival_override", {
    p_request_id: requestId,
    p_approve: body.approve,
    p_reason: reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ reviewed: true, approved: body.approve });
}
