import * as THREE from "three";
import { useEffect, useMemo, useState } from "react";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;
const TILE_URL = (z: number, x: number, y: number) =>
  `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}.pngraw?access_token=${MAPBOX_TOKEN}`;

function lonLatToTile(lon: number, lat: number, z: number) {
  const x = Math.floor(((lon + 180) / 360) * Math.pow(2, z));
  const y = Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
      ) /
        Math.PI) /
      2) *
      Math.pow(2, z)
  );
  return { x, y };
}
function tileToBbox(x: number, y: number, z: number) {
  const n = Math.pow(2, z);
  const lon1 = (x / n) * 360 - 180;
  const lat1 =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  const lon2 = ((x + 1) / n) * 360 - 180;
  const lat2 =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
  return { minLon: lon1, maxLon: lon2, minLat: lat2, maxLat: lat1 };
}
function elevationFromRGB(r: number, g: number, b: number) {
  return -10000 + (r * 256 * 256 + g * 256 + b) / 10.0;
}

type Props = {
  bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number };
  toLocal: (lat: number, lon: number) => THREE.Vector3; // same projection as route
  resolution?: number; // grid verts per side (e.g., 200–240)
  zExaggeration?: number;
  padMeters?: number;
  zoom?: number; // 13–14 good; higher = sharper/more tiles
};

export function Terrain({
  bbox,
  toLocal,
  resolution = 220,
  zExaggeration = 1.8,
  padMeters = 300,
  zoom = 13,
}: Props) {
  const [geom, setGeom] = useState<THREE.PlaneGeometry | null>(null);

  const expandedBbox = useMemo(() => {
    const centerLat = (bbox.minLat + bbox.maxLat) / 2;
    const m_per_deg_lat = 111320;
    const m_per_deg_lon = 111320 * Math.cos((centerLat * Math.PI) / 180);
    const dLat = padMeters / m_per_deg_lat;
    const dLon = padMeters / m_per_deg_lon;
    return {
      minLat: bbox.minLat - dLat,
      minLon: bbox.minLon - dLon,
      maxLat: bbox.maxLat + dLat,
      maxLon: bbox.maxLon + dLon,
    };
  }, [bbox, padMeters]);

  useEffect(() => {
    let aborted = false;
    async function build() {
      if (!MAPBOX_TOKEN) {
        console.warn("No VITE_MAPBOX_TOKEN set. Terrain will not render.");
        setGeom(null);
        return;
      }
      const tl = lonLatToTile(expandedBbox.minLon, expandedBbox.maxLat, zoom);
      const br = lonLatToTile(expandedBbox.maxLon, expandedBbox.minLat, zoom);

      const tiles: { x: number; y: number; z: number }[] = [];
      for (let x = tl.x; x <= br.x; x++)
        for (let y = tl.y; y <= br.y; y++) tiles.push({ x, y, z: zoom });

      const tileSize = 256;
      const cols = br.x - tl.x + 1;
      const rows = br.y - tl.y + 1;

      const canvas = document.createElement("canvas");
      canvas.width = cols * tileSize;
      canvas.height = rows * tileSize;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;

      for (const t of tiles) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.decoding = "async";
        const url = TILE_URL(t.z, t.x, t.y);
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            const dx = (t.x - tl.x) * tileSize;
            const dy = (t.y - tl.y) * tileSize;
            ctx.drawImage(img, dx, dy);
            resolve();
          };
          img.onerror = () => reject(new Error("Tile load failed: " + url));
          img.src = url;
        });
        if (aborted) return;
      }

      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      const geo = new THREE.PlaneGeometry(1, 1, resolution - 1, resolution - 1);
      const pos = geo.attributes.position as THREE.BufferAttribute;

      const stitchedBbox = {
        minLon: tileToBbox(tl.x, br.y, zoom).minLon,
        maxLon: tileToBbox(br.x, tl.y, zoom).maxLon,
        minLat: tileToBbox(tl.x, br.y, zoom).minLat,
        maxLat: tileToBbox(br.x, tl.y, zoom).maxLat,
      };

      for (let j = 0; j < resolution; j++) {
        for (let i = 0; i < resolution; i++) {
          const u = i / (resolution - 1);
          const v = j / (resolution - 1);

          const lon =
            stitchedBbox.minLon +
            u * (stitchedBbox.maxLon - stitchedBbox.minLon);
          const lat =
            stitchedBbox.maxLat +
            v * (stitchedBbox.minLat - stitchedBbox.maxLat);

          const px = Math.floor(u * (canvas.width - 1));
          const py = Math.floor(v * (canvas.height - 1));
          const k = (py * canvas.width + px) * 4;

          const elev = elevationFromRGB(data[k], data[k + 1], data[k + 2]);

          const p = toLocal(lat, lon);
          pos.setXYZ(i + j * resolution, p.x, elev * zExaggeration, p.z);
        }
      }

      pos.needsUpdate = true;

      // --- Vertex color by elevation ---
      const colors = [];
      let minElev = Infinity;
      let maxElev = -Infinity;

      // find elevation range
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y < minElev) minElev = y;
        if (y > maxElev) maxElev = y;
      }

      // create gradient colors
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const t = (y - minElev) / (maxElev - minElev + 1e-6);

        // color stops: 0 = green, 0.5 = brown, 1 = white
        const c = new THREE.Color();
        if (t < 0.5)
          c.setRGB(0.1 + t * 0.6, 0.5 + t * 0.3, 0.1); // green→brownish
        else c.setRGB(0.6 + t * 0.4, 0.45 + t * 0.3, 0.3 + t * 0.3); // brown→white

        colors.push(c.r, c.g, c.b);
      }
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

      geo.computeVertexNormals();
      if (!aborted) setGeom(geo);
    }
    build();
    return () => {
      aborted = true;
    };
  }, [expandedBbox, toLocal, resolution, zExaggeration, zoom]);

  if (!geom) return null;

  return (
    <mesh geometry={geom}>
      <meshStandardMaterial
        vertexColors
        roughness={1}
        metalness={0}
        flatShading={false}
      />
    </mesh>
  );
}
