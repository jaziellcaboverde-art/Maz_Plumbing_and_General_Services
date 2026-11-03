import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export type ServiceDetail = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  starting_price_php: number | null;
  price_note: string | null;
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
  const env = getSupabasePublicEnv();
  if (!env || !/^[0-9a-f-]{36}$/i.test(serviceId))
    return { service: null, photos: [], reviews: [] };
  const client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: service, error } = await client
    .from("services")
    .select("id,category,name,description,starting_price_php,price_note")
    .eq("id", serviceId)
    .eq("active", true)
    .maybeSingle();
  if (error || !service) return { service: null, photos: [], reviews: [] };
  // An older deployment without the migration should still show service details.
  const [portfolio, feedback, projects] = await Promise.all([
    client
      .from("service_portfolio")
      .select("id,image_path,caption,sort_order")
      .eq("service_id", serviceId)
      .order("sort_order")
      .order("created_at")
      .limit(12),
    client.rpc("public_service_reviews", { p_service_id: serviceId }),
    client.rpc("public_project_portfolio", { p_service: serviceId }),
  ]);
  return {
    service: {
      ...service,
      starting_price_php:
        service.starting_price_php == null
          ? null
          : Number(service.starting_price_php),
    },
    photos: [
      ...(projects.data ?? []).flatMap(
        (project: { id: string; title: string; photo_count: number }) =>
          Array.from({ length: project.photo_count }, (_, index) => ({
            id: `${project.id}-${index}`,
            caption: project.title,
            sort_order: index,
            imageUrl: `/api/portfolio/${project.id}/${index}`,
          })),
      ),
      ...(portfolio.data ?? []).map((photo) => ({
        id: photo.id,
        caption: photo.caption,
        sort_order: photo.sort_order,
        imageUrl: client.storage
          .from("service-portfolio")
          .getPublicUrl(photo.image_path).data.publicUrl,
      })),
    ],
    reviews: (feedback.data ?? []) as ServiceReview[],
  };
}
