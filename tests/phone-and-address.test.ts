import { describe, expect, test } from "vitest";
import { isPhMobile, localDigits, toE164 } from "@/lib/phone";
import { addressPartsFrom, matchBarangay } from "@/lib/location/address-parts";
import { matchMetroManilaArea } from "@/lib/location/metro-manila";

describe("mobile number with a fixed +63", () => {
  test("keeps only the 10 digits that follow +63", () => {
    expect(localDigits("+639171234567")).toBe("9171234567");
    expect(localDigits("09171234567")).toBe("9171234567");
    expect(localDigits("9171234567")).toBe("9171234567");
    expect(localDigits("917 123 4567 99")).toBe("9171234567");
    expect(localDigits("abc")).toBe("");
  });

  test("builds the full number the server expects", () => {
    expect(toE164("9171234567")).toBe("+639171234567");
    expect(isPhMobile(toE164("9171234567"))).toBe(true);
    expect(toE164("")).toBe("");
    expect(isPhMobile(toE164("917123"))).toBe(false);
  });
});

describe("address fields filled from a map lookup", () => {
  test("matches the city however the map spells it", () => {
    expect(matchMetroManilaArea("City of Manila")).toBe("Manila");
    expect(matchMetroManilaArea("Quezon City")).toBe("Quezon City");
    expect(matchMetroManilaArea("Las Piñas")).toBe("Las Piñas");
    expect(matchMetroManilaArea("Cebu City")).toBe("");
  });

  test("fills street, city and barangay from a Quezon City result", () => {
    const parts = addressPartsFrom({ housenumber: "12", street: "Scout Tuason", suburb: "Laging Handa", city: "Quezon City" });
    expect(parts.line1).toBe("12 Scout Tuason");
    expect(parts.city).toBe("Quezon City");
    expect(parts.barangay).toBe("Laging Handa");
  });

  test("leaves the barangay empty when the map name is not in the list", () => {
    const parts = addressPartsFrom({ street: "Ortigas Avenue", suburb: "Nowhere Land", city: "Pasig" });
    expect(parts.city).toBe("Pasig");
    expect(parts.barangay).toBe("");
    expect(matchBarangay("Pasig", ["Nowhere Land"])).toBe("");
  });

  test("does not use the barangay or city as the street", () => {
    const parts = addressPartsFrom({ address_line1: "Manggahan", suburb: "Manggahan", city: "Pasig" });
    expect(parts.line1).toBe("");
  });

  test("ignores places outside Metro Manila", () => {
    const parts = addressPartsFrom({ street: "Colon Street", city: "Cebu City" });
    expect(parts.city).toBe("");
    expect(parts.barangay).toBe("");
  });
});
