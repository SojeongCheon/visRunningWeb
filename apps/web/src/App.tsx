import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Terrain } from "./scenes/Terrain";
import { bboxFromLngLat } from "./utils/bbox";
import { FitCameraToPoints } from "./FitCameraToPoints"; // if you saved it here

type RoutePoint = {
  lat: number;
  lon: number;
  ele?: number | null;
  t?: number | null;
};
type RouteData = {
  points: RoutePoint[];
  stats?: { distance_km?: number; duration_s?: number | null };
};
const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// simple local projection around first point
function toLocalMetersFactory(refLat: number, refLon: number) {
  const R = 6371000;
  const lat0 = (refLat * Math.PI) / 180;
  const lon0 = (refLon * Math.PI) / 180;
  return (lat: number, lon: number) => {
    const φ = (lat * Math.PI) / 180;
    const λ = (lon * Math.PI) / 180;
    const x = (λ - lon0) * Math.cos((φ + lat0) / 2) * R;
    const z = (φ - lat0) * R;
    return new THREE.Vector3(x, 0, z);
  };
}

export default function App() {
  const [route, setRoute] = useState<RouteData | null>(null);

  const toLocal = useMemo(() => {
    if (!route?.points?.length)
      return (lat: number, lon: number) => new THREE.Vector3(0, 0, 0);
    const p0 = route.points[0];
    return toLocalMetersFactory(p0.lat, p0.lon);
  }, [route]);

  const pts = useMemo(
    () =>
      route?.points?.length
        ? route.points.map((p) => {
            const v = toLocal(p.lat, p.lon);
            v.y = p.ele ?? 0;
            return v;
          })
        : [],
    [route, toLocal]
  );

  const curve = useMemo(
    () =>
      pts.length > 1
        ? new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.05)
        : null,
    [pts]
  );

  const bbox = useMemo(
    () => (route?.points?.length ? bboxFromLngLat(route.points) : null),
    [route]
  );

  async function uploadFile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = (
      e.currentTarget.elements.namedItem("file") as HTMLInputElement
    ).files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API}/ingest`, { method: "POST", body: fd });
    const data: RouteData = await res.json();
    setRoute(data);
  }

  return (
    <div className="relative w-screen h-screen bg-zinc-900 text-white overflow-hidden">
      <Canvas
        className="absolute inset-0"
        camera={{ position: [120, 120, 120], fov: 60 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#121212"]} />
        <hemisphereLight intensity={0.8} groundColor={"#222"} />
        <directionalLight position={[120, 160, 120]} intensity={1.2} />

        {/* Terrain under the route */}
        {bbox && (
          <Terrain
            bbox={bbox}
            toLocal={toLocal}
            resolution={220}
            zExaggeration={2.5}
            padMeters={300}
            zoom={13}
          />
        )}

        {/* Route ribbon (no runner animation yet) */}
        {curve && (
          <mesh>
            <tubeGeometry args={[curve, 800, 1.2, 12, false]} />
            <meshStandardMaterial color="#00ffff" />
          </mesh>
        )}

        {/* Fit camera to the route points (once loaded) */}
        {pts.length > 1 && <FitCameraToPoints points={pts} padding={1.25} />}

        <OrbitControls makeDefault enableDamping dampingFactor={0.12} />
      </Canvas>

      {/* Floating upload panel */}
      <div className="absolute top-4 left-4 z-10 bg-black/70 backdrop-blur-sm p-4 rounded-md shadow-lg space-y-3 w-72">
        <form onSubmit={uploadFile} className="space-y-2">
          <div className="text-sm opacity-80">Upload GPX</div>
          <input
            name="file"
            type="file"
            accept=".gpx"
            className="block w-full text-xs"
          />
          <button className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-md">
            Upload
          </button>
        </form>
        {route?.stats?.distance_km && (
          <div className="text-xs opacity-80">
            {route.stats.distance_km.toFixed(2)} km
          </div>
        )}
      </div>
    </div>
  );
}
