import { Suspense } from "react";
import { SettingsScreen } from "@/components/ui/settings-screen";
import { BookingSection } from "@/components/workflow/booking-section";
import { AddressSection } from "./address-section";

export default function CustomerSettings() {
  return (
    <SettingsScreen>
      <Suspense fallback={<p role="status">Loading your addresses…</p>}>
        <BookingSection
          title="Saved addresses"
          presentation="card"
          description="Manage your service addresses and map pins."
          actionLabel="Manage addresses"
        >
          <AddressSection />
        </BookingSection>
      </Suspense>
    </SettingsScreen>
  );
}
