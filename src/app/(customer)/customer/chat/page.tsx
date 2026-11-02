import { ChatInbox } from "@/components/chat/chat-inbox";
import { loadChatInbox } from "@/lib/chat/load-inbox";

export default async function CustomerChatPage({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const [inbox, { booking }] = await Promise.all([loadChatInbox("customer"), searchParams]);
  return <ChatInbox {...inbox} initialBookingId={booking} />;
}
