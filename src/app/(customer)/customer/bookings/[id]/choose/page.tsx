import { Suspense } from "react";
import { redirect } from "next/navigation";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>Loading booking?</p>}>
      <Choose params={params} />
    </Suspense>
  );
}
async function Choose({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return redirect(`/customer/bookings/${encodeURIComponent(id)}`);
}
