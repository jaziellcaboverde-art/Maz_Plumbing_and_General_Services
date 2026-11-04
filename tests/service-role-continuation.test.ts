import { expect, test } from "vitest";
import { decideAccess } from "@/lib/auth/route-access";

test("a signed-in customer continues the selected service booking", () => {
  const next = "/customer/bookings/new?service=selected-service";
  expect(decideAccess("/login", "customer", false, next)).toEqual({
    allow: false,
    redirectTo: next,
  });
});

test.each(["admin", "provider"] as const)(
  "%s cannot continue into a customer's booking",
  (role) => {
    expect(
      decideAccess(
        "/login",
        role,
        false,
        "/customer/bookings/new?service=selected",
      ),
    ).toEqual({ allow: false, redirectTo: `/${role}` });
  },
);

test.each([
  "//evil.example",
  "https://evil.example",
  "/\\evil.example",
  "/login?next=/login",
])("unsafe or looping continuation is rejected: %s", (next) => {
  expect(decideAccess("/login", "customer", false, next)).toEqual({
    allow: false,
    redirectTo: "/customer",
  });
});
