export type Coordinates = { latitude: number; longitude: number };

export function isValidCoordinate(value: Coordinates): boolean {
  return Number.isFinite(value.latitude)
    && Number.isFinite(value.longitude)
    && value.latitude >= -90
    && value.latitude <= 90
    && value.longitude >= -180
    && value.longitude <= 180;
}

export function isPhilippinesCountryCode(value: unknown): boolean {
  return typeof value === "string" && value.toLowerCase() === "ph";
}

/** PostGIS uses longitude first for point construction. */
export function toLongitudeLatitude(point: Coordinates): [number, number] {
  return [point.longitude, point.latitude];
}

export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const earthRadiusMeters = 6_371_000;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const halfChord = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(halfChord));
}

export function withinArrivalRadius(distance: number, radius = 200): boolean {
  return Number.isFinite(distance) && distance >= 0 && distance <= radius;
}
