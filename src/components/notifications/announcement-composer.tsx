"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import styles from "./announcement-composer.module.css";

export function AnnouncementComposer() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          body: form.get("body"),
          audience: form.get("audience"),
          link: form.get("link"),
          requiresAck: form.get("requires_ack") === "on",
        }),
      });
      const result = await response.json() as { sent?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not publish the announcement.");
      formElement.reset();
      setMessage({ error: false, text: `Announcement sent to ${result.sent ?? 0} accounts.` });
    } catch (caught) {
      setMessage({ error: true, text: caught instanceof Error ? caught.message : "Could not publish the announcement." });
    } finally {
      setBusy(false);
    }
  }

  return <section className={styles.panel} aria-labelledby="compose-announcement">
    <h2 id="compose-announcement">Compose announcement</h2>
    <p>Broadcast service updates, holiday hours, outages, and policy changes.</p>
    <form className={styles.form} onSubmit={publish}>
      <Input label="Title" name="title" maxLength={120} required />
      <Textarea label="Message" name="body" maxLength={4000} rows={4} required />
      <div className={styles.options}>
        <Select label="Audience" name="audience" defaultValue="all">
          <option value="all">Customers and providers</option>
          <option value="customers">Customers</option>
          <option value="providers">Providers</option>
        </Select>
        <Input label="Learn more link (optional)" name="link" type="text" maxLength={500} hint="Use an internal app path beginning with /." />
      </div>
      <label className={styles.critical}>
        <input type="checkbox" name="requires_ack" />
        Critical — recipients must acknowledge before dismissing
      </label>
      <Button variant="primary" type="submit" loading={busy} disabled={busy}>Publish announcement</Button>
      {message && <p className={message.error ? styles.error : styles.success} role={message.error ? "alert" : "status"}>{message.text}</p>}
    </form>
  </section>;
}
