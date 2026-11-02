import { redirect } from "next/navigation";
import type { Role } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ChatConversation = {
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
  /** Messages from the other person that this customer or provider has not opened. Always 0 for admin. */
  unread: number;
};

export async function loadChatInbox(role: Role) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== role) redirect(profile?.role === "provider" ? "/provider" : profile?.role === "admin" ? "/admin" : "/customer");

  const admin = createAdminClient();
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
  if (bookingsError) return { userId: user.id, role, conversations: [] as ChatConversation[], error: "Could not load chat projects." };
  if (!bookings?.length) return { userId: user.id, role, conversations: [] as ChatConversation[] };

  const assignedBookings = bookings.filter((booking): booking is typeof booking & { provider_id: string } => typeof booking.provider_id === "string");
  if (!assignedBookings.length) return { userId: user.id, role, conversations: [] as ChatConversation[] };

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

  conversations.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return {
    userId: user.id,
    role,
    conversations,
    ...(messagesError ? { error: "Some message previews could not be loaded." } : {}),
  };
}

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
