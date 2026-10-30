import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/layout/page-heading";
import { ScheduleList } from "./schedule-list";
import styles from "./page.module.css";

type Props = { searchParams: Promise<{ q?: string | string[] }> };

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
    <PageHeading title="Provider schedules" description="See each provider's assigned jobs, service, status, and appointment details in one list." />
    <ScheduleList query={first(params.q)} />
  </section>;
}
