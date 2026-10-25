import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications/send";
import { readBody, requireUser, UUID } from "@/lib/matching/http";

const MAX_BODY = 4000;
const PHOTO_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i;

/**
 * Send a chat message. The insert runs as the signed-in person, so the database rules decide
 * who may write (the customer and the accepted provider, nobody else). Then the other person
 * is told. One unread alert per thread at a time, so a busy chat does not flood their inbox.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = await readBody(request);
  if (!UUID.test(id) || !input) return Response.json({ error: "This message could not be read." }, { status: 400 });

  const body = typeof input.body === "string" ? input.body.trim() : "";
  const attachmentPath = typeof input.attachmentPath === "string" && input.attachmentPath ? input.attachmentPath : null;
  if (!body && !attachmentPath) return Response.json({ error: "Write a message or add a photo." }, { status: 400 });
  if (body.length > MAX_BODY) return Response.json({ error: `Messages can be up to ${MAX_BODY} characters.` }, { status: 400 });
  if (attachmentPath && (!PHOTO_PATH.test(attachmentPath) || !attachmentPath.startsWith(`${id}/`))) {
    return Response.json({ error: "That photo does not belong to this chat." }, { status: 400 });
  }

  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { data: message, error } = await auth.session.from("messages")
    .insert({ booking_id: id, sender_id: auth.user.id, body: body || null, attachment_path: attachmentPath })
    .select("id,booking_id,sender_id,body,attachment_path,flagged,created_at").single();
  if (error || !message) {
    return Response.json({ error: "You cannot send messages in this chat." }, { status: 403 });
  }

  // The message is saved. A failed alert must never turn into a failed send.
  try { await tellOtherPerson(id, auth.user.id, Boolean(attachmentPath) && !body); }
  catch (caught) { console.error("could not send the chat alert", caught); }

  return Response.json({ ok: true, message });
}

async function tellOtherPerson(bookingId: string, senderId: string, photoOnly: boolean) {
  const admin = createAdminClient();
  const { data: booking } = await admin.from("bookings").select("customer_id,provider_id").eq("id", bookingId).maybeSingle();
  if (!booking?.customer_id || !booking.provider_id) return;
  const toCustomer = senderId === booking.provider_id;
  const recipient = toCustomer ? booking.customer_id : booking.provider_id;
  if (recipient === senderId) return;
  const link = `/${toCustomer ? "customer" : "provider"}/chat?booking=${bookingId}`;

  const { data: waiting } = await admin.from("notifications").select("id")
    .eq("profile_id", recipient).eq("event", "chat.message").eq("link", link).is("read_at", null).limit(1);
  if (waiting?.length) return;

  await sendNotification({
    profileId: recipient,
    event: "chat.message",
    title: photoOnly ? "You have a new photo in your booking chat" : "You have a new message in your booking chat",
    body: "Open the chat to read and reply.",
    link,
    channels: ["in_app", "email"],
  });
}
