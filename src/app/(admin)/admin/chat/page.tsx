import { ChatInbox } from "@/components/chat/chat-inbox";
import { loadChatInbox } from "@/lib/chat/load-inbox";

export default async function AdminChatPage() {
  const inbox = await loadChatInbox("admin");
  return <ChatInbox {...inbox} />;
}
