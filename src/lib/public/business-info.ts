/**
 * Facts the guest pages show about the business, as given by the owner.
 * A field left as null is not shown on the page, so nothing here is invented.
 */
export const BUSINESS = {
  name: "MAZ Plumbing and General Services",
  shortTagline: "Plumbing, electrical and general home services",
  tagline: "Licensed plumbing and electrical services. Honest work, fair price, done right the first time.",
  copyrightYear: 2026,
  /** About us paragraph from the owner. Left as null it is not shown, and the home page uses the tagline instead (open question Q51). */
  about: null as string | null,
  serviceArea: "Metro Manila and surrounding areas",
  address: null as string | null,
  hours: "Mon – Sat · 7:00 AM – 8:00 PM",
  hoursNote: "Emergency calls answered 24/7",
  phones: ["0917-327-2029", "0976-479-8534", "0966-176-5476"] as string[],
  email: "Mazplumbelectricalservices@gmail.com" as string | null,
  facebook: { label: "facebook.com/Malcolm2916", href: "https://facebook.com/Malcolm2916" } as { label: string; href: string } | null,
};
