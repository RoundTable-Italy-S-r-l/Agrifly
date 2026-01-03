/**
 * Utility functions per routing e calcolo distanze
 */

/**
 * Calcola la distanza tra due punti usando la formula di Haversine
 * Supporta sia array [lng, lat] che oggetti { lng, lat }
 */
export function calculateDistance(origin: any, destination: any): number {
  // Simple haversine distance calculation
  const R = 6371; // Earth's radius in km

  let lat1: number, lng1: number, lat2: number, lng2: number;

  if (Array.isArray(origin)) {
    lng1 = origin[0];
    lat1 = origin[1];
  } else {
    lng1 = origin.lng;
    lat1 = origin.lat;
  }

  if (Array.isArray(destination)) {
    lng2 = destination[0];
    lat2 = destination[1];
  } else {
    lng2 = destination.lng;
    lat2 = destination.lat;
  }

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Genera i link di navigazione per Google Maps, Apple Maps e Waze
 * @param originCoords Coordinate origine in formato "lat,lng"
 * @param destCoords Coordinate destinazione in formato "lat,lng"
 */
export function generateNavigationLinks(
  originCoords: string,
  destCoords: string,
) {
  return {
    google_maps: `https://www.google.com/maps/dir/${originCoords}/${destCoords}`,
    apple_maps: `https://maps.apple.com/?daddr=${destCoords}&saddr=${originCoords}`,
    waze: `https://waze.com/ul?ll=${destCoords}&navigate=yes`,
  };
}

/**
 * Converte coordinate in formato per GraphHopper API (lat,lng)
 * Supporta sia array [lng, lat] che oggetti { lng, lat }
 */
export function formatCoordinatesForGraphHopper(point: any): string {
  if (Array.isArray(point)) {
    return `${point[1]},${point[0]}`; // lat,lng for GraphHopper
  } else if (point.lng && point.lat) {
    return `${point.lat},${point.lng}`;
  }
  throw new Error("Invalid coordinate format");
}
