import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/layout/page-heading";
import { ScheduleCalendarView } from "./calendar-view";
import styles from "./page.module.css";

type Props = {
  searchParams: Promise<{ week?: string | string[]; provider?: string | string[]; status?: string | string[] }>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ProviderSchedulesPage({ searchParams }: Props) {
  await connection();
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") redirect("/customer");

  const params = await searchParams;
  return <section className={styles.page}>
    <PageHeading title="Provider schedule" description="Track every provider's jobs by week. Pick a provider or a status to narrow the calendar." />
    <ScheduleCalendarView week={first(params.week)} provider={first(params.provider)} status={first(params.status)} />
  </section>;
}
