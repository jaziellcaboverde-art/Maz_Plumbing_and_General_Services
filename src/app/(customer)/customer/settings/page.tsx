import { Suspense } from "react";
import { SettingsScreen } from "@/components/ui/settings-screen";
import { AddressSection } from "./address-section";

export default function CustomerSettings() {
  return (
    <SettingsScreen>
      <Suspense fallback={<p role="status">Loading your addresses…</p>}>
        <AddressSection />
      </Suspense>
    </SettingsScreen>
  );
}
