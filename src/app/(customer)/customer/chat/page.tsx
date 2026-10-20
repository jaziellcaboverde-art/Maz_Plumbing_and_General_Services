import { ChatInbox } from "@/components/chat/chat-inbox";
import { loadChatInbox } from "@/lib/chat/load-inbox";

export default async function CustomerChatPage() {
  const inbox = await loadChatInbox("customer");
  return <ChatInbox {...inbox} />;
}
