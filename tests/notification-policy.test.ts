import { describe, expect, test } from "vitest";
import { enabledNotificationChannels, isEmailPreferenceEnabled } from "@/lib/notifications/preference-policy";
import { deliveryFailureTransition } from "@/lib/notifications/retry-policy";

describe("notification preferences", () => {
  test("email is enabled when no preference has been saved", () => {
    expect(isEmailPreferenceEnabled(null)).toBe(true);
    expect(isEmailPreferenceEnabled({})).toBe(true);
  });

  test("a saved opt-out disables email only", () => {
    expect(isEmailPreferenceEnabled({ email_enabled: false })).toBe(false);
    expect(enabledNotificationChannels(["in_app", "email"], false)).toEqual(["in_app"]);
  });

  test("email and in-app remain selected when email is enabled", () => {
    expect(enabledNotificationChannels(["in_app", "email"], true)).toEqual(["in_app", "email"]);
  });
});

describe("notification retry timing", () => {
  const now = Date.parse("2026-10-19T00:00:00.000Z");

  test.each([1, 2])("attempt %i schedules the next attempt five minutes later", (attempts) => {
    expect(deliveryFailureTransition(attempts, now)).toEqual({
      status: "pending",
      nextAttemptAt: "2026-10-19T00:05:00.000Z",
    });
  });

  test("attempt three is final and has no further retry", () => {
    expect(deliveryFailureTransition(3, now)).toEqual({
      status: "failed",
      nextAttemptAt: "2026-10-19T00:00:00.000Z",
    });
  });
});
