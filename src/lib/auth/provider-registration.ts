type RegistrationError = { code?: string; message?: string } | null;

const MIGRATION_REQUIRED =
  "Provider signup is temporarily unavailable because the required database update has not been applied. Please contact the site administrator.";

export function providerRegistrationErrorMessage(error: RegistrationError): string {
  if (error?.code === "PGRST202" || /register_provider_applicant.*(not found|does not exist)/i.test(error?.message ?? "")) {
    return MIGRATION_REQUIRED;
  }
  return "Could not finish setting up your provider account. Try again.";
}
