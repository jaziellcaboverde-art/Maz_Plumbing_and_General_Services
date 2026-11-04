import { requireAdmin } from "@/lib/matching/http";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_CSV_BYTES,
  PROVIDERS_PER_REQUEST,
  validateProviders,
  type ProviderImportResult,
} from "@/lib/provider/admin-import";
import { provisionProvider } from "@/lib/provider/provision";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  let body;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_CSV_BYTES)
      return Response.json({ error: "Request is too large." }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (
    !body ||
    !Array.isArray(body.providers) ||
    !body.providers.length ||
    body.providers.length > PROVIDERS_PER_REQUEST ||
    !["manual", "csv"].includes(body.source)
  )
    return Response.json(
      {
        error: `Send 1-${PROVIDERS_PER_REQUEST} providers and choose manual or csv.`,
      },
      { status: 400 },
    );
  const keys = body.providers.map((row: unknown) =>
    row && typeof row === "object" && "key" in row ? row.key : null,
  );
  if (
    keys.some((key: unknown) => typeof key !== "string") ||
    new Set(keys).size !== keys.length
  )
    return Response.json(
      { error: "Each provider needs a unique row key." },
      { status: 400 },
    );
  const admin = createAdminClient();
  const catalog = await admin
    .from("services")
    .select("id,name,category")
    .eq("active", true);
  if (catalog.error)
    return Response.json(
      {
        error:
          "Could not verify the active services. No accounts were created.",
      },
      { status: 503 },
    );
  const validated = validateProviders(body.providers, catalog.data ?? []);
  const results: ProviderImportResult[] = [];
  for (let index = 0; index < validated.length; index += 3) {
    const completed = await Promise.all(
      validated
        .slice(index, index + 3)
        .map(
          async (
            row: (typeof validated)[number],
          ): Promise<ProviderImportResult> => {
            if (!row.value || !row.value.password)
              return {
                key: row.key,
                email: row.email,
                status: "failed",
                error:
                  row.errors.join(" ") ||
                  "A password must be set or generated before creating the provider.",
              };
            return provisionProvider(
              admin,
              auth.user.id,
              row.value,
              body.source,
            );
          },
        ),
    );
    results.push(...completed);
  }
  return Response.json(
    { results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
