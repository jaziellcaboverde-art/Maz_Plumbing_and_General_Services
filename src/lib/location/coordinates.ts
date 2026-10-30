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

/**
 * A rough box around Metro Manila (NCR) with a small margin. It is a bounding box, not the exact border,
 * so a pin just outside the border can pass. Used to keep service addresses in the launch area (Q22).
 */
export const METRO_MANILA_BOUNDS = { south: 14.33, north: 14.8, west: 120.88, east: 121.17 } as const;
export const METRO_MANILA_CENTER: Coordinates = { latitude: 14.5995, longitude: 120.9842 };

export function isInsideMetroManila(value: Coordinates): boolean {
  return isValidCoordinate(value)
    && value.latitude >= METRO_MANILA_BOUNDS.south
    && value.latitude <= METRO_MANILA_BOUNDS.north
    && value.longitude >= METRO_MANILA_BOUNDS.west
    && value.longitude <= METRO_MANILA_BOUNDS.east;
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
