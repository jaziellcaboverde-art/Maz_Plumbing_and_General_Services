import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications/send";
import { readBody, requireUser, UUID } from "@/lib/matching/http";

const MAX_BODY = 4000;
const PHOTO_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i;

export async function POST(request: Request) {
  const input = await readBody(request);
  if (!input) return Response.json({ error: "This message could not be read." }, { status: 400 });
  const supportThreadId = typeof input.supportThreadId === "string" ? input.supportThreadId : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const context = typeof input.context === "string" ? input.context.trim() : "";
  const contextBookingId = typeof input.contextBookingId === "string" ? input.contextBookingId : "";
  const attachmentPath = typeof input.attachmentPath === "string" && input.attachmentPath ? input.attachmentPath : null;
  if (!UUID.test(supportThreadId)) return Response.json({ error: "Choose a valid support conversation." }, { status: 400 });
  if (!body && !attachmentPath) return Response.json({ error: "Write a message or add a photo." }, { status: 400 });
  if (body.length > MAX_BODY) return Response.json({ error: `Messages can be up to ${MAX_BODY} characters.` }, { status: 400 });
  if (attachmentPath && (!PHOTO_PATH.test(attachmentPath) || !attachmentPath.startsWith(`${supportThreadId}/`))) {
    return Response.json({ error: "That photo does not belong to this chat." }, { status: 400 });
  }

  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (context.length > 250) return Response.json({ error: "The support context is too long." }, { status: 400 });
  const admin = createAdminClient();
  const { data: contextThread, error: contextThreadError } = await admin.from("support_threads")
    .select("customer_id").eq("id", supportThreadId).maybeSingle();
  if (contextThreadError) return Response.json({ error: "Support context could not be loaded." }, { status: 500 });
  if (contextThread?.customer_id === auth.user.id) {
    let bookingId: string | null = null;
    if (contextBookingId) {
      if (!UUID.test(contextBookingId)) return Response.json({ error: "Choose a valid booking reference." }, { status: 400 });
      const { data: booking, error: bookingError } = await admin.from("bookings").select("id")
        .eq("id", contextBookingId).eq("customer_id", auth.user.id).maybeSingle();
      if (bookingError) return Response.json({ error: "The booking reference could not be checked." }, { status: 500 });
      if (!booking) return Response.json({ error: "That booking does not belong to your account." }, { status: 403 });
      bookingId = booking.id;
    }
    const { error: contextError } = await admin.from("support_threads")
      .update({ context: context || null, context_booking_id: bookingId }).eq("id", supportThreadId);
    if (contextError) return Response.json({ error: "Support context could not be saved." }, { status: 500 });
  }
  const { data: message, error } = await auth.session.from("messages")
    .insert({
      support_thread_id: supportThreadId,
      sender_id: auth.user.id,
      body: body || null,
      attachment_path: attachmentPath,
    })
    .select("id,booking_id,support_thread_id,sender_id,body,attachment_path,flagged,created_at")
    .single();
  if (error || !message) {
    return Response.json({ error: "You cannot send messages in this support chat." }, { status: 403 });
  }

  const { data: thread } = await admin.from("support_threads")
    .select("customer_id").eq("id", supportThreadId).maybeSingle();
  if (thread && auth.user.id !== thread.customer_id) {
    try {
      const link = "/customer/chat?support=1";
      const { data: unread } = await admin.from("notifications").select("id")
        .eq("profile_id", thread.customer_id).eq("event", "chat.support").eq("link", link)
        .is("read_at", null).is("dismissed_at", null).limit(1);
      if (!unread?.length) {
        await sendNotification({
          profileId: thread.customer_id,
          event: "chat.support",
          category: "account",
          title: "MAZ Support replied to your message",
          body: "Open your support conversation to read and reply.",
          link,
          channels: ["in_app", "email"],
        });
      }
    } catch (caught) {
      console.error("could not send the support chat alert", caught);
    }
  }
  return Response.json({ ok: true, message });
}
