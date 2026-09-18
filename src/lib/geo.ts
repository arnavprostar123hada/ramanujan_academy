/** Distance in meters between two lat/lng points (Haversine). */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

/** minutes difference between an HH:mm:ss time string and a Date */
export function minutesLate(expected: string | null | undefined, actual: Date): number | null {
  if (!expected) return null;
  const [h, m] = expected.split(":").map(Number);
  const exp = new Date(actual);
  exp.setHours(h, m || 0, 0, 0);
  return Math.round((actual.getTime() - exp.getTime()) / 60000);
}

export const LATE_GRACE_MINUTES = 15;
