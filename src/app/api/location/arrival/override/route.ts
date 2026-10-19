import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to request an override." }, { status: 401 });
  let body: { bookingId?: unknown; reason?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Explain why GPS check-in failed." }, { status: 400 }); }
  const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!bookingId || reason.length < 10 || reason.length > 1000) {
    return NextResponse.json({ error: "Enter a reason of 10 to 1,000 characters." }, { status: 400 });
  }
  const { data, error } = await supabase.rpc("request_arrival_override", { p_booking_id: bookingId, p_reason: reason });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ requestId: data }, { status: 201 });
}
