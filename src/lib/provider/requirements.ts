/**
 * What a provider must upload to apply. One list, used by the apply page and the submit form,
 * so the wording cannot drift apart. The API route enforces the same required items.
 */
export const REQUIRED_PROVIDER_DOCUMENTS = [
  "Government ID and a selfie holding the ID",
  "NBI clearance",
  "Barangay clearance or proof of address",
  "Two references and years of experience",
] as const;

export const OPTIONAL_PROVIDER_DOCUMENTS = [
  "Skills certificate (for example TESDA)",
  "Resume or work history",
  "Medical or fit-to-work certificate",
] as const;
