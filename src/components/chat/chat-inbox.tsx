"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowLeft, Send, Search } from "lucide-react";
import type { Role } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/browser";
import type { ChatConversation } from "@/lib/chat/load-inbox";
import styles from "./chat-inbox.module.css";

type ChatMessage = {
  id: string;
  booking_id: string;
  sender_id: string;
  body: string | null;
  attachment_path?: string | null;
  created_at: string;
};

export function ChatInbox({
  role,
  userId,
  conversations,
  error,
}: {
  role: Role;
  userId: string;
  conversations: ChatConversation[];
  error?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.bookingId ?? null);
  const [threads, setThreads] = useState(conversations);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selected = threads.find((conversation) => conversation.bookingId === selectedId) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return threads;
    return threads.filter((conversation) => [
      conversation.displayName,
      conversation.displayDetail,
      conversation.service,
      conversation.description,
      conversation.customerName,
      conversation.providerName,
      conversation.preview,
    ].some((value) => value.toLocaleLowerCase().includes(needle)));
  }, [threads, query]);

  const updateThreadPreview = useCallback((message: ChatMessage) => {
    setThreads((current) => current.map((conversation) => conversation.bookingId === message.booking_id
      ? { ...conversation, preview: message.body || (message.attachment_path ? "Attachment" : "New message"), updatedAt: message.created_at }
      : conversation).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    const client = createClient();
    clientRef.current = client;
    let active = true;
    setLoading(true);
    setMessageError(null);

    const channel = client
      .channel(`booking-chat-${selectedId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `booking_id=eq.${selectedId}`,
      }, (payload) => {
        const incoming = payload.new as ChatMessage;
        setMessages((current) => current.some((message) => message.id === incoming.id)
          ? current
          : [...current, incoming].sort((left, right) => left.created_at.localeCompare(right.created_at)));
      })
      .subscribe();

    void client.from("messages")
      .select("id,booking_id,sender_id,body,attachment_path,created_at")
      .eq("booking_id", selectedId)
      .order("created_at", { ascending: true })
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) setMessageError("Could not load this conversation.");
        else {
          setMessages((current) => mergeMessages(data ?? [], current));
          const latest = data?.[data.length - 1];
          if (latest) updateThreadPreview(latest);
        }
        setLoading(false);
      });

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [selectedId, updateThreadPreview]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function openConversation(bookingId: string) {
    setSelectedId(bookingId);
    setNotice(null);
    setDraft("");
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || role === "admin" || sending) return;
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setMessageError(null);
    setNotice(null);
    const client = clientRef.current ?? createClient();
    try {
      const { data, error: sendError } = await client.from("messages").insert({
        booking_id: selected.bookingId,
        sender_id: userId,
        body,
      }).select("id,booking_id,sender_id,body,attachment_path,created_at").single();
      if (sendError || !data) setMessageError("Message could not be sent. Please retry.");
      else {
        setMessages((current) => mergeMessages(current, [data]));
        updateThreadPreview(data);
        setDraft("");
        setNotice("Message sent.");
      }
    } catch {
      setMessageError("Message could not be sent. Please retry.");
    } finally {
      setSending(false);
    }
  }

  return <section className={styles.page}>
    <header className={styles.heading}>
      <div><h1>Inbox</h1><p>{threads.length} booking conversations</p></div>
      {role === "admin" && <span className={styles.readOnly}>Admin view · read only</span>}
    </header>
    {error && <p className={styles.warning} role="status">{error}</p>}
    <div className={styles.inbox} data-role={role} data-open={Boolean(selected)}>
      <aside className={styles.listPane} aria-label="Conversations">
      <div className={styles.listHeading}><strong>Messages</strong><span>{filtered.length}</span></div>
        <label className={styles.search}>
          <Search size={17} aria-hidden="true" />
          <span className={styles.visuallyHidden}>Search conversations</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search messages" />
        </label>
        <div className={styles.conversationList}>
          {filtered.map((conversation) => <button
            className={`${styles.conversation} ${conversation.bookingId === selectedId ? styles.selected : ""}`}
            key={conversation.bookingId}
            onClick={() => openConversation(conversation.bookingId)}
            type="button"
          >
            <span className={styles.avatar} data-list-avatar="true" aria-hidden="true">{initials(conversation.displayName)}</span>
            <span className={styles.conversationCopy}>
              <span className={styles.conversationTop}><strong>{conversation.displayName}</strong><time>{shortDate(conversation.updatedAt)}</time></span>
              <span className={styles.conversationDetail}>{conversation.service}</span>
              <span className={styles.preview}>{conversation.preview}</span>
            </span>
          </button>)}
          {!filtered.length && <p className={styles.empty}>{threads.length ? "No conversations match your search." : "Booking chats appear after a provider accepts a project."}</p>}
        </div>
      </aside>

      <main className={styles.threadPane}>
        {selected ? <>
          <header className={styles.threadHeader}>
            <button type="button" className={styles.backButton} onClick={() => setSelectedId(null)} aria-label="Back to conversations"><ArrowLeft size={19} /></button>
            <span className={styles.avatar} aria-hidden="true">{initials(selected.displayName)}</span>
            <div className={styles.threadTitle}><strong>{selected.displayName}</strong><span>{selected.service} · {statusLabel(selected.status)}</span></div>
          </header>
          <div className={styles.messages} aria-live="polite" aria-label="Conversation messages">
            {loading && <p className={styles.empty}>Loading messages…</p>}
            {!loading && !messages.length && <p className={styles.empty}>No messages yet. Start the conversation about this booking.</p>}
            {messages.map((message) => {
              const mine = message.sender_id === userId;
              const sender = mine ? "You" : role === "admin"
                ? message.sender_id === selected.customerId ? "Customer" : "Provider"
                : selected.displayName;
              return <article className={`${styles.message} ${mine ? styles.mine : styles.theirs}`} key={message.id}>
                {!mine && <span className={styles.sender}>{sender}</span>}
                <p>{message.body || (message.attachment_path ? "Attachment" : "")}</p>
                <time dateTime={message.created_at}>{timeLabel(message.created_at)}</time>
              </article>;
            })}
            <div ref={bottomRef} />
          </div>
          {role === "admin" ? <p className={styles.readOnlyNote}>Admins can review booking conversations. Only the customer and assigned provider can send messages.</p> : <form className={styles.composer} onSubmit={sendMessage}>
            <label className={styles.visuallyHidden} htmlFor="chat-message">Write a message</label>
            <textarea id="chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} maxLength={4000} placeholder="Write a message…" rows={2} />
            <button type="submit" disabled={sending || !draft.trim()} aria-label="Send message"><Send size={18} />{sending ? "Sending" : "Send"}</button>
          </form>}
          {messageError && <p className={styles.error} role="alert">{messageError}</p>}
          {notice && <p className={styles.notice} role="status">{notice}</p>}
        </> : <div className={styles.emptyThread}><strong>Select a conversation</strong><span>Choose a booking chat to see its messages.</span></div>}
      </main>

      <aside className={styles.detailsPane} aria-label="Booking details">
        {selected ? <>
          <div className={styles.detailsHead}><span className={styles.avatarLarge}>{initials(selected.customerName)}</span><strong>{selected.customerName}</strong><span>Customer</span></div>
          <dl className={styles.details}>
            <div><dt>Project</dt><dd>{selected.service}</dd></div>
            <div><dt>Status</dt><dd>{statusLabel(selected.status)}</dd></div>
            <div><dt>Provider</dt><dd>{selected.providerName}</dd></div>
            <div><dt>Booking</dt><dd className={styles.bookingId}>{selected.bookingId}</dd></div>
          </dl>
          <section className={styles.projectCard}><span>Project details</span><p>{selected.description}</p></section>
        </> : <p className={styles.empty}>Booking details appear here.</p>}
      </aside>
    </div>
  </section>;
}

function mergeMessages(first: ChatMessage[], second: ChatMessage[]) {
  const byId = new Map<string, ChatMessage>();
  for (const message of [...first, ...second]) byId.set(message.id, message);
  return [...byId.values()].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(new Date(value));
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
