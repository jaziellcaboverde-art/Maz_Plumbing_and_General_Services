import { Suspense } from "react";
import { AdminReports } from "@/components/workflow/admin-screens";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  return (
    <Suspense fallback={<p role="status">Loading MAZ operations?</p>}>
      <Report searchParams={searchParams} />
    </Suspense>
  );
}
async function Report({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  return <AdminReports {...await searchParams} />;
}
