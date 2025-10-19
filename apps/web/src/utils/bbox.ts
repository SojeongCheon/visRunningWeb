export type BBox = {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
};

export function bboxFromLngLat(points: { lat: number; lon: number }[]): BBox {
  let minLat = +90,
    maxLat = -90,
    minLon = +180,
    maxLon = -180;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return { minLat, minLon, maxLat, maxLon };
}
