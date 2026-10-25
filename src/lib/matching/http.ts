import "server-only";

import { createClient } from "@/lib/supabase/server";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function requireUser() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { error: Response.json({ error: "Sign in to continue." }, { status: 401 }) } as const;
  return { session, user } as const;
}

export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The database functions raise plain-language messages (errors with code P0001, P0002 or 42501),
 * so those are safe to show. Anything else is hidden behind a generic message.
 */
export function databaseError(error: { code?: string; message: string }, fallback: string): Response {
  const safe = error.code === "P0001" || error.code === "P0002" || error.code === "42501";
  const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : safe ? 409 : 500;
  return Response.json({ error: safe ? error.message : fallback }, { status });
}
