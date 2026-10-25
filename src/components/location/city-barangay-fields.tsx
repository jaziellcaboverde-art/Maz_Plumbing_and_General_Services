"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { METRO_MANILA_AREAS } from "@/lib/location/metro-manila";
import { METRO_MANILA_BARANGAYS } from "@/lib/location/metro-manila-barangays";

type Props = {
  /** Pass both to let the parent fill the fields, for example from a map lookup. */
  city?: string;
  barangay?: string;
  onChange?: (next: { city: string; barangay: string }) => void;
};

/**
 * City, then the barangays of that city. MAZ serves Metro Manila, so the city is a list
 * and there is no province field. The form reads the values by name: "city" and "barangay".
 * Used alone it keeps its own state. With city, barangay and onChange the parent owns the values.
 */
export function CityBarangayFields({ city: cityProp, barangay: barangayProp, onChange }: Props = {}) {
  const controlled = cityProp !== undefined && barangayProp !== undefined;
  const [ownCity, setOwnCity] = useState("");
  const [ownBarangay, setOwnBarangay] = useState("");
  const city = controlled ? cityProp : ownCity;
  const barangay = controlled ? barangayProp : ownBarangay;
  const barangays = city ? METRO_MANILA_BARANGAYS[city] ?? [] : [];

  function update(next: { city: string; barangay: string }) {
    setOwnCity(next.city);
    setOwnBarangay(next.barangay);
    onChange?.(next);
  }

  return (
    <>
      <Select label="City or municipality" name="city" autoComplete="address-level2" required value={city}
        onChange={(event) => update({ city: event.target.value, barangay: "" })}>
        <option value="">Choose a city</option>
        {METRO_MANILA_AREAS.map((name) => <option key={name} value={name}>{name}</option>)}
      </Select>
      <Select label="Barangay" name="barangay" autoComplete="address-level3" required disabled={!city} value={barangay}
        hint={city ? undefined : "Choose a city first."}
        onChange={(event) => update({ city, barangay: event.target.value })}>
        <option value="">{city ? "Choose a barangay" : "Choose a city first"}</option>
        {barangays.map((name) => <option key={name} value={name}>{name}</option>)}
      </Select>
    </>
  );
}
