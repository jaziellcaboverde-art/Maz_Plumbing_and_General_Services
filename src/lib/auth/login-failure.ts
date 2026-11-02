/** Non-sensitive reason codes to distinguish connection/setup problems from wrong credentials. */
export type LoginFailure =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "invalid_configuration"
  | "connection_failed"
  | "service_unavailable"
  | "rate_limited";

export function classifyLoginFailure(error: unknown): LoginFailure {
  const err = error as {
    code?: string;
    message?: string;
    name?: string;
    status?: number;
  } | null;
  const code = typeof err?.code === "string" ? err.code.toLowerCase() : "";
  const message =
    typeof err?.message === "string" ? err.message.toLowerCase() : "";
  const name = typeof err?.name === "string" ? err.name : "";
  const status = err?.status;
  if (code === "email_not_confirmed" || message.includes("email not confirmed"))
    return "email_not_confirmed";
  if (
    status === 429 ||
    /rate.limit|too many requests|too many attempts/.test(message)
  )
    return "rate_limited";
  if (
    /invalid api key|invalid apikey|no api key found|apikey.*invalid|invalid jwt|jwt.*invalid/.test(
      message,
    ) ||
    code === "invalid_api_key" ||
    code === "invalid_jwt"
  )
    return "invalid_configuration";
  if (
    name === "AuthRetryableFetchError" ||
    /fetch failed|failed to fetch|network|econn|enotfound|eai_again|etimedout|timeout|aborterror/.test(
      message,
    )
  ) {
    return "connection_failed";
  }
  if (status && status >= 500) return "service_unavailable";
  return "invalid_credentials";
}
