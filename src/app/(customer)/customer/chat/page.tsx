import { ChatInbox } from "@/components/chat/chat-inbox";
import { loadChatInbox } from "@/lib/chat/load-inbox";

export default async function CustomerChatPage({ searchParams }: { searchParams: Promise<{ booking?: string; support?: string; topic?: string; bookingRef?: string }> }) {
  const [inbox, params] = await Promise.all([loadChatInbox("customer"), searchParams]);
  return <ChatInbox {...inbox} initialBookingId={params.booking} initialSupport={params.support === "1"}
    supportTopic={params.topic ?? (params.bookingRef ? "Your booking" : undefined)}
    supportBookingId={params.bookingRef} />;
}
