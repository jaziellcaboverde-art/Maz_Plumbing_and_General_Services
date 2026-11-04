/** Only letters/numbers, spaces and hyphens enter PostgREST filter expressions. */
export function bookingSearchTerm(value?: string) {
  return (
    value
      ?.trim()
      .replace(/[^\p{L}\p{N} -]/gu, "")
      .slice(0, 100) ?? ""
  );
}

export function customerNameFilter(term: string) {
  const words = term.split(/\s+/).filter(Boolean);
  return `and(${words.map((word) => `or(first_name.ilike.%${word}%,last_name.ilike.%${word}%)`).join(",")})`;
}
