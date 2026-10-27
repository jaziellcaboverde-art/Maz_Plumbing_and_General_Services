import { redirect } from "next/navigation";
import type { Role } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ChatConversation = {
  type: "booking" | "support";
  bookingId: string;
  status: string;
  service: string;
  description: string;
  customerId: string;
  customerName: string;
  providerId: string;
  providerName: string;
  displayName: string;
  displayDetail: string;
  preview: string;
  updatedAt: string;
  /** Unread messages from the other person; admin unread is tracked only for support threads. */
  unread: number;
};

export async function loadChatInbox(role: Role) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== role) redirect(profile?.role === "provider" ? "/provider" : profile?.role === "admin" ? "/admin" : "/customer");

  const admin = createAdminClient();
  const support = await loadSupportConversations(role, user.id, admin);
  const bookingsQuery = () => admin
    .from("bookings")
    .select("id,customer_id,provider_id,status,description,updated_at,services:services!bookings_service_id_fkey(name)")
    .not("provider_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(100);

  const { data: bookings, error: bookingsError } = role === "customer"
    ? await bookingsQuery().eq("customer_id", user.id)
    : role === "provider"
      ? await bookingsQuery().eq("provider_id", user.id)
      : await bookingsQuery();
  if (bookingsError) return {
    userId: user.id, role, conversations: support.conversations,
    error: support.error ?? "Could not load booking chats.",
  };
  if (!bookings?.length) return {
    userId: user.id, role, conversations: support.conversations,
    ...(support.error ? { error: support.error } : {}),
  };

  const assignedBookings = bookings.filter((booking): booking is typeof booking & { provider_id: string } => typeof booking.provider_id === "string");
  if (!assignedBookings.length) return {
    userId: user.id, role, conversations: support.conversations,
    ...(support.error ? { error: support.error } : {}),
  };

  const profileIds = [...new Set(assignedBookings.flatMap((booking) => [booking.customer_id, booking.provider_id]))];
  const [{ data: people }, { data: messages, error: messagesError }] = await Promise.all([
    admin.from("profiles").select("id,first_name,last_name,business_name,account_type").in("id", profileIds),
    session.from("messages").select("id,booking_id,sender_id,body,created_at").in("booking_id", assignedBookings.map((booking) => booking.id)).order("created_at", { ascending: false }).limit(500),
  ]);

  // Unread counts come from the database. If the function is missing or fails, show no badges instead of failing the page.
  const unreadByBooking = new Map<string, number>();
  if (role !== "admin") {
    const { data: unreadRows } = await session.rpc("chat_unread_counts");
    for (const row of (unreadRows ?? []) as Array<{ booking_id: string; unread: number | string }>) {
      unreadByBooking.set(row.booking_id, Number(row.unread));
    }
  }

  const peopleById = new Map((people ?? []).map((person) => [person.id, person]));
  const latestByBooking = new Map<string, { body: string | null; created_at: string; sender_id: string }>();
  for (const message of messages ?? []) {
    if (!latestByBooking.has(message.booking_id)) latestByBooking.set(message.booking_id, message);
  }

  const conversations = assignedBookings.map((booking) => {
    const customer = peopleById.get(booking.customer_id);
    const provider = peopleById.get(booking.provider_id);
    const customerContact = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ");
    const customerName = customer?.business_name || customerContact || "Customer";
    const providerName = [provider?.first_name, provider?.last_name].filter(Boolean).join(" ") || "Provider";
    const latest = latestByBooking.get(booking.id);
    const service = first(booking.services)?.name || "Service request";
    const preview = messagesError
      ? "Messages unavailable"
      : latest?.body || (latest ? "Attachment" : "No messages yet. Start the conversation.");

    return {
      type: "booking" as const,
      bookingId: booking.id,
      status: booking.status,
      service,
      description: booking.description || "No project details provided.",
      customerId: booking.customer_id,
      customerName,
      providerId: booking.provider_id,
      providerName,
      displayName: role === "customer" ? providerName : customerName,
      displayDetail: role === "admin" ? `Provider: ${providerName}` : service,
      preview,
      updatedAt: latest?.created_at ?? booking.updated_at,
      unread: unreadByBooking.get(booking.id) ?? 0,
    } satisfies ChatConversation;
  });

  conversations.push(...support.conversations);
  conversations.sort((left, right) => {
    if (left.type !== right.type) return left.type === "support" ? -1 : 1;
    return right.updatedAt.localeCompare(left.updatedAt);
  });
  return {
    userId: user.id,
    role,
    conversations,
    ...((messagesError || support.error) ? { error: support.error ?? "Some message previews could not be loaded." } : {}),
  };
}

async function loadSupportConversations(
  role: Role,
  userId: string,
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ conversations: ChatConversation[]; error?: string }> {
  if (role === "provider") return { conversations: [] };
  if (role === "customer") {
    const { error: threadError } = await admin.from("support_threads")
      .upsert({ customer_id: userId }, { onConflict: "customer_id", ignoreDuplicates: true });
    if (threadError) return { conversations: [], error: "MAZ Support could not be loaded." };
  }
  const query = admin.from("support_threads").select("id,customer_id,context,context_booking_id,updated_at")
    .order("updated_at", { ascending: false }).limit(role === "admin" ? 100 : 1);
  if (role === "customer") query.eq("customer_id", userId);
  const { data: threads, error: threadQueryError } = await query;
  if (threadQueryError) return { conversations: [], error: "MAZ Support could not be loaded." };
  if (!threads?.length) return { conversations: [] };

  const ids = threads.map((thread) => thread.id);
  const [
    { data: messages, error: messageError },
    { data: reads, error: readError },
    { data: people, error: peopleError },
  ] = await Promise.all([
    admin.from("messages").select("id,support_thread_id,sender_id,body,attachment_path,created_at")
      .in("support_thread_id", ids).order("created_at", { ascending: false }).limit(500),
    admin.from("support_message_reads").select("support_thread_id,profile_id,last_read_at")
      .in("support_thread_id", ids).eq("profile_id", userId),
    admin.from("profiles").select("id,first_name,last_name,business_name").in("id", [...new Set(threads.map((thread) => thread.customer_id))]),
  ]);
  const personById = new Map((people ?? []).map((person) => [person.id, person]));
  const latest = new Map<string, { body: string | null; attachment_path: string | null; created_at: string; sender_id: string }>();
  const unread = new Map<string, number>();
  const lastRead = new Map((reads ?? []).map((read) => [read.support_thread_id, read.last_read_at]));
  for (const message of messages ?? []) {
    const threadId = message.support_thread_id;
    if (!threadId) continue;
    if (!latest.has(threadId)) latest.set(threadId, message);
    if (message.sender_id !== userId && message.created_at > (lastRead.get(threadId) ?? "")) {
      unread.set(threadId, (unread.get(threadId) ?? 0) + 1);
    }
  }

  return {
    conversations: threads.map((thread) => {
      const person = personById.get(thread.customer_id);
      const customerName = person?.business_name
        || [person?.first_name, person?.last_name].filter(Boolean).join(" ")
        || "Customer";
      const message = latest.get(thread.id);
      return {
        type: "support",
        bookingId: thread.id,
        status: "support",
        service: "MAZ Support",
        description: thread.context_booking_id
          ? `${thread.context || "Customer support"} · Booking ${thread.context_booking_id}`
          : thread.context || "General customer support conversation.",
        customerId: thread.customer_id,
        customerName,
        providerId: "",
        providerName: "MAZ Support",
        displayName: role === "customer" ? "MAZ Support" : customerName,
        displayDetail: role === "customer" ? "Usually replies within business hours" : "Support queue",
        preview: messageError ? "Messages unavailable" : message?.body || (message ? "Photo attachment" : "Start a conversation with MAZ Support."),
        updatedAt: message?.created_at ?? thread.updated_at,
        unread: unread.get(thread.id) ?? 0,
      };
    }),
    ...((messageError || readError || peopleError) ? {
      error: messageError ? "Support message previews could not be loaded."
        : readError ? "Support unread counts could not be loaded."
          : "Support customer details could not be loaded.",
    } : {}),
  };
}

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
