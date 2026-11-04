import { expect, test, vi } from "vitest";
import type { createAdminClient } from "@/lib/supabase/admin";
import { provisionProvider } from "@/lib/provider/provision";
import type { PreparedProvider } from "@/lib/provider/admin-import";

const row: PreparedProvider = {
  key: "1",
  email: "worker@example.com",
  password: "private-temp-password",
  firstName: "Juan",
  lastName: "Cruz",
  mobile: "+639171234567",
  dailyRate: 800,
  serviceArea: "Pasig",
  serviceIds: ["service-1"],
};
function client(failure = "", cleanupFailure = false) {
  const events: string[] = [];
  const writes: Array<{ table: string; value: unknown }> = [];
  const result = (step: string) => {
    events.push(step);
    return {
      data: step === failure ? null : { id: "new-id" },
      error: step === failure ? { message: "Failure" } : null,
    };
  };
  const admin = {
    auth: {
      admin: {
        createUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "new-id" } }, error: null }),
        deleteUser: vi
          .fn()
          .mockResolvedValue({
            error: cleanupFailure ? { message: "Failed" } : null,
          }),
      },
    },
    from: vi.fn((table: string) => {
      let step = table;
      const builder = {
        update: (value: Record<string, unknown>) => {
          writes.push({ table, value });
          step =
            table === "profiles"
              ? value.role
                ? "activation"
                : "profile"
              : table;
          return builder;
        },
        eq: () => builder,
        select: () => builder,
        single: async () => result(step),
        insert: async (value: unknown) => {
          writes.push({ table, value });
          return result(table);
        },
      };
      return builder;
    }),
    rpc: vi.fn(async () => result("audit")),
  };
  return {
    admin,
    typed: admin as unknown as ReturnType<typeof createAdminClient>,
    events,
    writes,
  };
}
test("admin-created providers get approved profiles, approved services, provider access and a password-free audit", async () => {
  const { admin, typed, events, writes } = client();
  expect(await provisionProvider(typed, "admin-id", row, "csv")).toMatchObject({
    status: "created",
    providerId: "new-id",
  });
  expect(admin.auth.admin.createUser).toHaveBeenCalledWith(
    expect.objectContaining({
      email_confirm: true,
      app_metadata: { role: "customer" },
    }),
  );
  expect(
    writes.find((write) => write.table === "provider_profiles")?.value,
  ).toMatchObject({ status: "approved", reviewed_by: "admin-id" });
  expect(
    writes.find((write) => write.table === "provider_service_claims")?.value,
  ).toEqual([
    expect.objectContaining({
      status: "approved",
      service_id: "service-1",
      decided_by: "admin-id",
    }),
  ]);
  expect(events.indexOf("activation")).toBeGreaterThan(
    events.indexOf("provider_services"),
  );
  expect(JSON.stringify(admin.rpc.mock.calls)).not.toContain(row.password);
  expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
});
test.each([
  "profile",
  "provider_profiles",
  "provider_service_claims",
  "provider_services",
  "activation",
  "audit",
])("setup failure at %s rolls back only the new auth user", async (failure) => {
  const { typed, admin } = client(failure);
  expect(
    await provisionProvider(typed, "admin-id", row, "manual"),
  ).toMatchObject({
    status: "failed",
    error: expect.stringContaining("rolled back"),
  });
  expect(admin.auth.admin.deleteUser).toHaveBeenCalledExactlyOnceWith("new-id");
});
test("an existing email is never converted, overwritten or deleted", async () => {
  const { typed, admin } = client();
  admin.auth.admin.createUser.mockResolvedValue({
    data: { user: null },
    error: { code: "email_exists", message: "Email already exists" },
  } as never);
  expect(
    await provisionProvider(typed, "admin-id", row, "manual"),
  ).toMatchObject({
    status: "failed",
    error: expect.stringContaining("existing account was not changed"),
  });
  expect(admin.from).not.toHaveBeenCalled();
  expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
});
test("cleanup failure is explicitly uncertain so it is not automatically retried", async () => {
  const { typed } = client("provider_services", true);
  expect(
    await provisionProvider(typed, "admin-id", row, "manual"),
  ).toMatchObject({
    status: "uncertain",
    error: expect.stringContaining("directory before retrying"),
  });
});
test("an interrupted auth response is not falsely reported as rolled back", async () => {
  const { typed, admin } = client();
  admin.auth.admin.createUser.mockRejectedValue(new Error("Connection lost"));
  expect(
    await provisionProvider(typed, "admin-id", row, "manual"),
  ).toMatchObject({ status: "uncertain" });
  expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
});
