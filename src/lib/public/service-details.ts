import { localPortfolio } from "./local-portfolio";
import { LAUNCH_SERVICES } from "./launch-services";
import { serviceSlug } from "./service-path";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export type ServiceDetail = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  starting_price_php: number | null;
  price_note: string | null;
  imageUrl?: string | null;
};
export type PortfolioPhoto = {
  id: string;
  imageUrl: string;
  caption: string;
  sort_order: number;
};
export type ServiceReview = {
  stars: number;
  comment: string | null;
  created_at: string;
};

export async function loadServiceDetails(serviceId: string): Promise<{
  service: ServiceDetail | null;
  photos: PortfolioPhoto[];
  reviews: ServiceReview[];
}> {
  const isId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      serviceId,
    );
  const launch = LAUNCH_SERVICES.find(
    (item) => serviceSlug(item.name) === serviceId,
  );
  const empty = { service: null, photos: [], reviews: [] };
  if (!isId && !launch) return empty;
  const env = getSupabasePublicEnv();
  if (!env) {
    return launch
      ? {
          service: {
            id: serviceId,
            category: launch.category,
            name: launch.name,
            description: launch.description,
            starting_price_php: null,
            price_note: null,
          },
          photos: localPortfolio(launch.name),
          reviews: [],
        }
      : empty;
  }
  const client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: service, error } = await client
    .from("services")
    .select(
      "id,category,name,description,starting_price_php,price_note,image_path",
    )
    .eq(isId ? "id" : "name", isId ? serviceId : launch!.name)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error("Could not load this service. Please try again.");
  if (!service) return { service: null, photos: [], reviews: [] };
  const resolvedId = service.id;
  // An older deployment without the migration should still show service details.
  const [portfolio, feedback, projects] = await Promise.all([
    client
      .from("service_portfolio")
      .select("id,image_path,caption,sort_order")
      .eq("service_id", resolvedId)
      .order("sort_order")
      .order("created_at")
      .limit(12),
    client.rpc("public_service_reviews", { p_service_id: resolvedId }),
    client.rpc("public_project_portfolio", { p_service: resolvedId }),
  ]);
  return {
    service: {
      id: service.id,
      name: service.name,
      category: service.category,
      description: service.description,
      price_note: service.price_note,
      imageUrl: service.image_path
        ? client.storage.from("service-photos").getPublicUrl(service.image_path)
            .data.publicUrl
        : null,
      starting_price_php:
        service.starting_price_php == null
          ? null
          : Number(service.starting_price_php),
    },
    photos: [
      ...(portfolio.data ?? []).map((photo) => ({
        id: photo.id,
        caption: photo.caption,
        sort_order: photo.sort_order,
        imageUrl: client.storage
          .from("service-portfolio")
          .getPublicUrl(photo.image_path).data.publicUrl,
      })),
      ...(projects.data ?? []).flatMap(
        (project: { id: string; title: string; photo_count: number }) =>
          Array.from({ length: project.photo_count }, (_, index) => ({
            id: `${project.id}-${index}`,
            caption: project.title,
            sort_order: index,
            imageUrl: `/api/portfolio/${project.id}/${index}`,
          })),
      ),
    ],
    reviews: (feedback.data ?? []) as ServiceReview[],
  };
}
