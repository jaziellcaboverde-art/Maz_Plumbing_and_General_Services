import { createClient } from "@/lib/supabase/server";
import { dayAndTime } from "@/lib/matching/format";
import styles from "./workspace.module.css";
export async function ApprovedProjectUpdates({
  bookingId,
}: {
  bookingId: string;
}) {
  const client = await createClient();
  const { data, error } = await client
    .from("provider_work_updates")
    .select("id,kind,notes,photo_paths,created_at")
    .eq("booking_id", bookingId)
    .eq("review_status", "approved")
    .in("kind", ["inspection", "progress", "milestone", "completion"])
    .order("created_at", { ascending: false });
  if (error) return <p role="alert">Project updates could not be loaded.</p>;
  if (!data?.length) return null;
  const updates = await Promise.all(
    data.map(async (row) => {
      const { data: photos } = row.photo_paths.length
        ? await client.storage
            .from("proof-photos")
            .createSignedUrls(row.photo_paths, 300)
        : { data: [] };
      return { ...row, photos: photos ?? [] };
    }),
  );
  return (
    <section className={styles.card}>
      <h2>MAZ-reviewed project updates</h2>
      {updates.map((update) => (
        <article className={styles.card} key={update.id}>
          <strong>{update.kind.replaceAll("_", " ")}</strong>
          <p>{update.notes}</p>
          <span>{dayAndTime(update.created_at)}</span>
          <div className={styles.actions}>
            {update.photos.map((photo, index) => (
              <a
                key={photo.path}
                href={photo.signedUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
              >
                Project photo {index + 1}
              </a>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
