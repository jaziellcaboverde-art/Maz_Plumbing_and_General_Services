import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CityBarangayFields } from "@/components/location/city-barangay-fields";
import { METRO_MANILA_AREAS } from "@/lib/location/metro-manila";
import { METRO_MANILA_BARANGAYS } from "@/lib/location/metro-manila-barangays";

describe("city and barangay fields", () => {
  test("every Metro Manila city has barangays", () => {
    for (const city of METRO_MANILA_AREAS) expect(METRO_MANILA_BARANGAYS[city]?.length).toBeGreaterThan(0);
  });

  test("the barangay list waits for a city and then shows that city's barangays", async () => {
    render(<CityBarangayFields />);
    expect(screen.getByLabelText(/Barangay/)).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText(/City or municipality/), "Pasig");
    const barangay = screen.getByLabelText(/Barangay/);
    expect(barangay).toBeEnabled();
    expect(screen.getByRole("option", { name: "Manggahan" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Province/)).toBeNull();
  });
});

describe("city and barangay fields filled by the parent", () => {
  test("shows the city and barangay the parent passes in", () => {
    render(<CityBarangayFields city="Pasig" barangay="Manggahan" />);
    expect(screen.getByLabelText(/City or municipality/)).toHaveValue("Pasig");
    expect(screen.getByLabelText(/Barangay/)).toHaveValue("Manggahan");
  });

  test("changing the city clears the barangay and tells the parent", async () => {
    const seen: Array<{ city: string; barangay: string }> = [];
    render(<CityBarangayFields city="Pasig" barangay="Manggahan" onChange={(next) => seen.push(next)} />);
    await userEvent.selectOptions(screen.getByLabelText(/City or municipality/), "Makati");
    expect(seen.at(-1)).toEqual({ city: "Makati", barangay: "" });
  });
});
