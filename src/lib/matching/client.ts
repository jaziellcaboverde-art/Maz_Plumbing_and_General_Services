/** Browser helper for the Phase 7 routes. Returns an error message to show, or null on success. */
export async function postJson(url: string, body: unknown): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (response.ok) return null;
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    return data?.error ?? "Something went wrong. Try again.";
  } catch {
    return "Could not reach the server. Check your connection and try again.";
  }
}
