import { ChatInbox } from "@/components/chat/chat-inbox";
import { loadChatInbox } from "@/lib/chat/load-inbox";

export default async function ProviderChatPage() {
  const inbox = await loadChatInbox("provider");
  return <ChatInbox {...inbox} />;
}
