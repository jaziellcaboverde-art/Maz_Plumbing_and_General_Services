import { ActionLink } from "@/components/ui/action-link";
import { createClient } from "@/lib/supabase/server";
import { dayAndTime } from "@/lib/matching/format";
import { EmptyState } from "@/components/ui/empty-state";
import styles from "./workspace.module.css";

type Update = {
  id: string;
  booking_id: string;
  kind: string;
  notes: string;
  photo_paths: string[];
  review_status: string;
  review_note: string | null;
  created_at: string;
};
export async function WorkUpdateList({ updates }: { updates: Update[] }) {
  if (!updates.length)
    return (
      <EmptyState
        title="No submissions yet"
        description="Send findings, evidence or issues from an assigned job."
      />
    );
  const client = await createClient();
  const rows = await Promise.all(
    updates.map(async (update) => {
      const { data } = update.photo_paths.length
        ? await client.storage
            .from("proof-photos")
            .createSignedUrls(update.photo_paths, 300)
        : { data: [] };
      return { ...update, photos: (data ?? []).filter((p) => p.signedUrl) };
    }),
  );
  return (
    <ul className={styles.list}>
      {rows.map((update) => (
        <li key={update.id} className={styles.card}>
          <div className={styles.head}>
            <strong>{update.kind.replaceAll("_", " ")}</strong>
            <span className={styles.tag}>
              {update.review_status === "pending"
                ? "Awaiting MAZ review"
                : update.review_status === "approved"
                  ? "Reviewed by MAZ"
                  : "Corrections requested"}
            </span>
          </div>
          <span className={styles.muted}>{dayAndTime(update.created_at)}</span>
          <p>{update.notes}</p>
          {update.review_note && (
            <p>
              <strong>MAZ response:</strong> {update.review_note}
            </p>
          )}
          <div className={styles.photos}>
            {update.photos.map((photo, index) => (
              <a
                key={photo.path}
                href={photo.signedUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
              >
                Evidence photo {index + 1}
              </a>
            ))}
          </div>
          <ActionLink href={`/provider/jobs/${update.booking_id}`}>
            Open assignment
          </ActionLink>
        </li>
      ))}
    </ul>
  );
}
