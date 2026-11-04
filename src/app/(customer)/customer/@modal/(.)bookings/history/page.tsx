import { redirect } from "next/navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  const query = new URLSearchParams(await searchParams).toString();
  redirect("/customer/history" + (query ? `?${query}` : ""));
}
