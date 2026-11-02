import { redirect } from "next/navigation";

type Params = { week?: string | string[]; provider?: string | string[] };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The calendar now lives inside Provider schedule. Old links and bookmarks land there. */
export default async function AdminCalendarPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const query = new URLSearchParams({ view: "calendar" });
  const week = first(params.week);
  const provider = first(params.provider);
  if (week) query.set("week", week);
  if (provider) query.set("provider", provider);
  redirect(`/admin/provider-schedules?${query.toString()}`);
}
