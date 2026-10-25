import { ChatInbox } from "@/components/chat/chat-inbox";
import { loadChatInbox } from "@/lib/chat/load-inbox";

export default async function ProviderChatPage({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const [inbox, { booking }] = await Promise.all([loadChatInbox("provider"), searchParams]);
  return <ChatInbox {...inbox} initialBookingId={booking} />;
}
