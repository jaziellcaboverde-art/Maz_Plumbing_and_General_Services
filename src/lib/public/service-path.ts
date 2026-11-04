import type { PublicService } from "./launch-services";
export function serviceSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export function servicePath(service: PublicService, customer = false): string {
  return `${customer ? "/customer" : ""}/services/${encodeURIComponent(service.id || serviceSlug(service.name))}`;
}
