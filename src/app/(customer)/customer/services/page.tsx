import { Suspense } from "react";
import { LiveServices } from "@/components/public/service-grid";
import { PageHeading } from "@/components/layout/page-heading";
import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";

export default function CustomerServicesPage() {
  return (
    <section>
      <PageHeading
        title="Services & portfolio"
        description="Explore MAZ services, published work and customer reviews. Choose a service to start your booking."
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <LiveServices bookLinks />
      </Suspense>
    </section>
  );
}
