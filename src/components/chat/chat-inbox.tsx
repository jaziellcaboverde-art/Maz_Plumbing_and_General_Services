"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowLeft, Flag, ImagePlus, RotateCcw, Search, Send, X } from "lucide-react";
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
  flagged?: boolean;
  created_at: string;
};

/** A message that did not reach the server. It stays on screen until it is retried or discarded. */
type FailedSend = { key: string; bookingId: string; body: string; attachmentPath: string | null; reason: string };

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_EXTENSION: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MESSAGE_COLUMNS = "id,booking_id,sender_id,body,attachment_path,flagged,created_at";

export function ChatInbox({
  role,
  userId,
  conversations,
  error,
  initialBookingId,
}: {
  role: Role;
  userId: string;
  conversations: ChatConversation[];
  error?: string;
  /** Opens this booking's thread first, for example from a notification link. */
  initialBookingId?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    conversations.find((conversation) => conversation.bookingId === initialBookingId)?.bookingId ?? conversations[0]?.bookingId ?? null,
  );
  const [threads, setThreads] = useState(conversations);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [failed, setFailed] = useState<FailedSend[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [flagError, setFlagError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selected = threads.find((conversation) => conversation.bookingId === selectedId) ?? null;
  // Messages of a thread opened earlier stay in state while the next one loads, so only show this thread's.
  const threadMessages = useMemo(() => messages.filter((message) => message.booking_id === selectedId), [messages, selectedId]);
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

  /** Tell the database this person has read the thread, and clear its badge. Admins only read, so they track nothing. */
  const markRead = useCallback((bookingId: string) => {
    if (role === "admin") return;
    setThreads((current) => current.map((conversation) => conversation.bookingId === bookingId && conversation.unread > 0
      ? { ...conversation, unread: 0 } : conversation));
    void (clientRef.current ?? createClient()).rpc("mark_chat_read", { p_booking_id: bookingId });
  }, [role]);

  useEffect(() => {
    if (!selectedId) return;
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
        updateThreadPreview(incoming);
        if (incoming.sender_id !== userId) markRead(incoming.booking_id);
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `booking_id=eq.${selectedId}`,
      }, (payload) => {
        const changed = payload.new as ChatMessage;
        setMessages((current) => current.map((message) => message.id === changed.id ? { ...message, flagged: changed.flagged } : message));
      })
      .subscribe();

    markRead(selectedId);

    void client.from("messages")
      .select(MESSAGE_COLUMNS)
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
  }, [selectedId, updateThreadPreview, markRead, userId]);

  // Photos sit in a private bucket, so each one needs a short lived signed link.
  useEffect(() => {
    const missing = messages.map((message) => message.attachment_path).filter((path): path is string => Boolean(path) && !photoUrls[path as string]);
    if (!missing.length) return;
    let active = true;
    const client = clientRef.current ?? createClient();
    void Promise.all(missing.map(async (path) => {
      const { data } = await client.storage.from("chat-photos").createSignedUrl(path, 60 * 60);
      return [path, data?.signedUrl] as const;
    })).then((pairs) => {
      if (!active) return;
      setPhotoUrls((current) => ({ ...current, ...Object.fromEntries(pairs.filter(([, url]) => url) as Array<[string, string]>) }));
    });
    return () => { active = false; };
  }, [messages, photoUrls]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages]);

  function openConversation(bookingId: string) {
    setSelectedId(bookingId);
    setNotice(null);
    setDraft("");
    setPhoto(null);
    setPhotoError(null);
    setFlagError(null);
  }

  function choosePhoto(file: File | undefined) {
    setPhotoError(null);
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) { setPhotoError("Choose a JPG, PNG or WebP photo."); return; }
    if (file.size > MAX_PHOTO_BYTES) { setPhotoError("Photos can be up to 5 MB."); return; }
    setPhoto(file);
  }

  function clearPhoto() {
    setPhoto(null);
    setPhotoError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  /** Save the message through the server so the other person is told. Returns an error to show, or null. */
  async function postMessage(bookingId: string, body: string, attachmentPath: string | null): Promise<string | null> {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body, attachmentPath }),
      });
      const result = await response.json().catch(() => null) as { message?: ChatMessage; error?: string } | null;
      if (!response.ok || !result?.message) return result?.error ?? "Message could not be sent.";
      setMessages((current) => mergeMessages(current, [result.message as ChatMessage]));
      updateThreadPreview(result.message);
      return null;
    } catch {
      return "No connection. Check your signal and retry.";
    }
  }

  async function retrySend(item: FailedSend) {
    if (sending) return;
    setSending(true);
    setFailed((current) => current.filter((entry) => entry.key !== item.key));
    const problem = await postMessage(item.bookingId, item.body, item.attachmentPath);
    if (problem) setFailed((current) => [...current, { ...item, reason: problem }]);
    setSending(false);
  }

  async function toggleFlag(message: ChatMessage) {
    setFlagError(null);
    const next = !message.flagged;
    const { error: flagFailure } = await (clientRef.current ?? createClient()).rpc("flag_message", { p_message_id: message.id, p_flagged: next });
    if (flagFailure) { setFlagError("Could not change the flag. Try again."); return; }
    setMessages((current) => current.map((entry) => entry.id === message.id ? { ...entry, flagged: next } : entry));
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
    if (!body && !photo) return;
    setSending(true);
    setMessageError(null);
    setPhotoError(null);
    setNotice(null);
    const client = clientRef.current ?? createClient();
    let attachmentPath: string | null = null;
    if (photo) {
      const path = `${selected.bookingId}/${crypto.randomUUID()}.${PHOTO_EXTENSION[photo.type]}`;
      const { error: uploadError } = await client.storage.from("chat-photos").upload(path, photo, { contentType: photo.type });
      if (uploadError) {
        setPhotoError("The photo could not be uploaded. Try again.");
        setSending(false);
        return;
      }
      attachmentPath = path;
    }
    const problem = await postMessage(selected.bookingId, body, attachmentPath);
    if (problem) {
      setFailed((current) => [...current, { key: crypto.randomUUID(), bookingId: selected.bookingId, body, attachmentPath, reason: problem }]);
    } else {
      setNotice("Message sent.");
    }
    setDraft("");
    clearPhoto();
    setSending(false);
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
              <span className={styles.previewRow}><span className={styles.preview}>{conversation.preview}</span>{conversation.unread > 0 && <span className={styles.unread} aria-label={`${conversation.unread} unread ${conversation.unread === 1 ? "message" : "messages"}`}>{conversation.unread}</span>}</span>
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
            {!loading && !threadMessages.length && <p className={styles.empty}>No messages yet. Start the conversation about this booking.</p>}
            {threadMessages.map((message) => {
              const mine = message.sender_id === userId;
              const sender = mine ? "You" : role === "admin"
                ? message.sender_id === selected.customerId ? "Customer" : "Provider"
                : selected.displayName;
              return <article className={`${styles.message} ${mine ? styles.mine : styles.theirs}`} key={message.id}>
                {!mine && <span className={styles.sender}>{sender}</span>}
                {message.attachment_path && (photoUrls[message.attachment_path]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <a href={photoUrls[message.attachment_path]} target="_blank" rel="noreferrer"><img className={styles.photo} src={photoUrls[message.attachment_path]} alt="Photo sent in this chat" /></a>
                  : <p className={styles.mutedText}>Loading photo…</p>)}
                {message.body && <p>{message.body}</p>}
                <div className={styles.messageFoot}>
                  {role === "admin" && message.flagged && <span className={styles.flagTag}>Flagged</span>}
                  {role === "admin" && <button type="button" className={styles.flagButton} onClick={() => toggleFlag(message)}>
                    <Flag size={14} aria-hidden="true" />{message.flagged ? "Remove flag" : "Flag message"}
                  </button>}
                  <time dateTime={message.created_at}>{timeLabel(message.created_at)}</time>
                </div>
              </article>;
            })}
            {failed.filter((item) => item.bookingId === selected.bookingId).map((item) => <article className={`${styles.message} ${styles.mine} ${styles.failedMessage}`} key={item.key}>
              {item.attachmentPath && <p className={styles.mutedText}>Photo attached</p>}
              {item.body && <p>{item.body}</p>}
              <span className={styles.error} role="alert">Not sent. {item.reason}</span>
              <div className={styles.retryRow}>
                <button type="button" onClick={() => retrySend(item)} disabled={sending}><RotateCcw size={14} aria-hidden="true" />Retry</button>
                <button type="button" onClick={() => setFailed((current) => current.filter((entry) => entry.key !== item.key))}><X size={14} aria-hidden="true" />Discard</button>
              </div>
            </article>)}
            <div ref={bottomRef} />
          </div>
          {role === "admin" ? <p className={styles.readOnlyNote}>Admins can review booking conversations. Only the customer and assigned provider can send messages.</p> : <form className={styles.composer} onSubmit={sendMessage}>
            <label className={styles.visuallyHidden} htmlFor="chat-message">Write a message</label>
            <input ref={fileInput} className={styles.visuallyHidden} type="file" accept={PHOTO_TYPES.join(",")} aria-label="Add a photo"
              tabIndex={-1} onChange={(event) => choosePhoto(event.target.files?.[0])} />
            <button type="button" className={styles.attach} disabled={sending} onClick={() => fileInput.current?.click()} aria-label="Add a photo"><ImagePlus size={18} aria-hidden="true" /></button>
            <textarea id="chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} maxLength={4000} placeholder="Write a message…" rows={2} />
            <button type="submit" disabled={sending || (!draft.trim() && !photo)} aria-label="Send message"><Send size={18} />{sending ? "Sending" : "Send"}</button>
          </form>}
          {photo && role !== "admin" && <p className={styles.attachPreview}>Photo ready: {photo.name}<button type="button" onClick={clearPhoto}><X size={14} aria-hidden="true" />Remove</button></p>}
          {photoError && <p className={styles.error} role="alert">{photoError}</p>}
          {flagError && <p className={styles.error} role="alert">{flagError}</p>}
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
