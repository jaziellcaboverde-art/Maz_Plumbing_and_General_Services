type ServiceChoice = { id: string; name: string; category: string };
export type ServiceRequest = {
  service?: string;
  serviceName?: string;
  category?: string;
};
const normalize = (value: string) => value.trim().toLocaleLowerCase("en");

/** Resolve catalog links against the active services loaded by the booking page. */
export function requestedService<T extends ServiceChoice>(
  services: readonly T[],
  request: ServiceRequest,
): T | undefined {
  if (request.service)
    return services.find((service) => service.id === request.service);
  if (!request.serviceName) return undefined;
  const matches = services.filter(
    (service) => normalize(service.name) === normalize(request.serviceName!),
  );
  if (matches.length === 1) return matches[0];
  const categoryMatches = matches.filter(
    (service) =>
      request.category &&
      normalize(service.category) === normalize(request.category),
  );
  return categoryMatches.length === 1 ? categoryMatches[0] : undefined;
}
