import { AssignmentReleaseForm } from "@/components/provider/assignment-release-form";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/layout/page-heading";
import {
  WorkReviewControls,
  ProjectSignoff,
  TeamOfferForm,
  MazQuoteForm,
  MazAppointmentForm,
  WorkMilestoneForm,
} from "@/components/provider/admin-work-controls";
import { createClient } from "@/lib/supabase/server";
import { dayAndTime } from "@/lib/matching/format";
import styles from "@/components/provider/workspace.module.css";

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading provider work…</p>}>
      <Review />
    </Suspense>
  );
}
async function Review() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  const [updates, bookings, providers, assignments] = await Promise.all([
    client
      .from("provider_work_updates")
      .select("*")
      .eq("review_status", "pending")
      .order("created_at"),
    client
      .from("bookings")
      .select("id,status,description,provider_id")
      .in("status", [
        "open",
        "offered",
        "accepted",
        "quoted",
        "deposit_paid",
        "scheduled",
        "on_the_way",
        "in_progress",
      ])
      .order("created_at", { ascending: false }),
    client
      .from("provider_profiles")
      .select(
        "profile_id,profiles!provider_profiles_profile_id_fkey(first_name,last_name)",
      )
      .eq("status", "approved"),
    client
      .from("provider_assignments")
      .select(
        "id,provider_id,booking_id,trade,status,starts_at,ends_at,expires_at,response_note",
      )
      .in("status", [
        "offered",
        "accepted",
        "withdrawal_requested",
        "expired",
        "declined",
      ])
      .order("starts_at"),
  ]);
  if (updates.error || bookings.error || providers.error || assignments.error)
    return (
      <p role="alert">
        Could not load provider operations. Please refresh or contact your
        system administrator.
      </p>
    );
  const evidence = await Promise.all(
    (updates.data ?? []).map(async (u) => {
      const { data } = u.photo_paths.length
        ? await client.storage
            .from("proof-photos")
            .createSignedUrls(u.photo_paths, 300)
        : { data: [] };
      return { ...u, photos: data ?? [] };
    }),
  );
  function workerName(id: string) {
    const person = providers.data?.find(
      (provider) => provider.profile_id === id,
    )?.profiles;
    const profile = Array.isArray(person) ? person[0] : person;
    return (
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      "MAZ worker"
    );
  }
  return (
    <section className={styles.stack}>
      <PageHeading
        title="Provider work & team assignments"
        description="Review findings and evidence, offer project roles and sign off verified completion."
      />
      <article className={styles.card}>
        <TeamOfferForm
          bookings={(bookings.data ?? []).map((b) => ({
            id: b.id,
            label: `${b.id.slice(0, 8)} · ${b.description ?? b.status}`,
          }))}
          providers={(providers.data ?? []).map((p) => {
            const person = Array.isArray(p.profiles)
              ? p.profiles[0]
              : p.profiles;
            return {
              id: p.profile_id,
              label:
                [person?.first_name, person?.last_name]
                  .filter(Boolean)
                  .join(" ") || p.profile_id,
            };
          })}
        />
      </article>
      <h2>Appointments and quotations</h2>
      {bookings.data?.map((b) => (
        <article className={styles.card} key={b.id}>
          <h3>{b.description ?? b.id}</h3>
          <p>
            Booking {b.id} | {b.status}
          </p>
          {["open", "accepted", "quoted", "deposit_paid"].includes(
            b.status,
          ) && (
            <MazAppointmentForm
              bookingId={b.id}
              leads={[
                ...(assignments.data ?? [])
                  .filter(
                    (a) => a.booking_id === b.id && a.status === "accepted",
                  )
                  .map((a) => ({
                    id: a.provider_id,
                    label: a.trade + " | " + workerName(a.provider_id),
                  })),
                ...(b.provider_id
                  ? [
                      {
                        id: b.provider_id,
                        label:
                          "Current accepted lead | " +
                          workerName(b.provider_id),
                      },
                    ]
                  : []),
              ]}
            />
          )}
          {["accepted", "quoted"].includes(b.status) && (
            <MazQuoteForm bookingId={b.id} />
          )}
          <WorkMilestoneForm bookingId={b.id} />
        </article>
      ))}
      <h2>Team assignments and replacement queue</h2>
      <ul className={styles.list}>
        {assignments.data?.map((a) => (
          <li className={styles.card} key={a.id}>
            <strong>
              {a.trade} ·{" "}
              {a.status === "offered" && Date.parse(a.expires_at) <= Date.now()
                ? "expired"
                : a.status.replaceAll("_", " ")}
            </strong>
            <p>Booking {a.booking_id}</p>
            <p>{workerName(a.provider_id)}</p>
            {a.response_note && <p>{a.response_note}</p>}
            <p>
              {dayAndTime(a.starts_at)} to {dayAndTime(a.ends_at)}
            </p>
            {["accepted", "offered", "withdrawal_requested"].includes(
              a.status,
            ) && <AssignmentReleaseForm id={a.id} admin />}
          </li>
        ))}
      </ul>
      <h2>Awaiting review ({evidence.length})</h2>
      {!evidence.length && <p>No pending submissions.</p>}
      {evidence.map((u) => (
        <article key={u.id} className={styles.card}>
          <h3>{u.kind.replaceAll("_", " ")}</h3>
          <p>{u.notes}</p>
          <p>Submitted by {workerName(u.provider_id)}</p>
          <p>{dayAndTime(u.created_at)}</p>
          <div className={styles.actions}>
            {u.photos.map(
              (
                photo: { path: string; signedUrl?: string | null },
                index: number,
              ) => (
                <a
                  href={photo.signedUrl ?? undefined}
                  key={photo.path}
                  target="_blank"
                  rel="noreferrer"
                >
                  Evidence photo {index + 1}
                </a>
              ),
            )}
          </div>
          <WorkReviewControls
            id={u.id}
            bookingId={u.booking_id}
            completion={u.kind === "completion"}
          />
        </article>
      ))}
      <h2>Final completion sign-off</h2>
      {bookings.data
        ?.filter((b) => b.status === "in_progress")
        .map((b) => (
          <article className={styles.card} key={b.id}>
            <strong>{b.description ?? b.id}</strong>
            <ProjectSignoff bookingId={b.id} />
          </article>
        ))}
    </section>
  );
}
