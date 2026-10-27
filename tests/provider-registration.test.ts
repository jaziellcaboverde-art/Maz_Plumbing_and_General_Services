import { describe, expect, test } from "vitest";
import { providerRegistrationErrorMessage } from "@/lib/auth/provider-registration";

describe("provider role registration errors", () => {
  test("explains when the provider registration migration is missing", () => {
    expect(providerRegistrationErrorMessage({
      code: "PGRST202",
      message: "Could not find the function public.register_provider_applicant in the schema cache",
    })).toContain("required database update has not been applied");
  });

  test("keeps other registration failures generic", () => {
    expect(providerRegistrationErrorMessage({ code: "42501", message: "permission denied" }))
      .toBe("Could not finish setting up your provider account. Try again.");
  });
});
