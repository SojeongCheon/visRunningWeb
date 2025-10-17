import { useState, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { FitCameraToPoints } from "./FitCameraToPoints";

type RoutePoint = { lat: number; lon: number; ele?: number };
type RouteData = { points: RoutePoint[]; stats?: { distance_km: number } };
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [route, setRoute] = useState<RouteData | null>(null);

  // convert gps lat/lon → local x/z meters
  const points = useMemo(() => {
    if (!route) return [];
    const R = 6371000;
    const lat0 = (route.points[0].lat * Math.PI) / 180;
    const lon0 = (route.points[0].lon * Math.PI) / 180;
    return route.points.map((p) => {
      const lat = (p.lat * Math.PI) / 180;
      const lon = (p.lon * Math.PI) / 180;
      const x = (lon - lon0) * Math.cos((lat + lat0) / 2) * R;
      const z = (lat - lat0) * R;
      const y = p.ele ?? 0;
      return new THREE.Vector3(x, y, z);
    });
  }, [route]);

  // build a smooth 3D curve from the points
  const curve = useMemo(() => {
    if (points.length < 2) return null;
    return new THREE.CatmullRomCurve3(points);
  }, [points]);

  async function uploadFile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = (
      e.currentTarget.elements.namedItem("file") as HTMLInputElement
    ).files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API}/ingest`, { method: "POST", body: fd });
    setRoute(await res.json());
  }

  return (
    <div className="relative w-screen h-screen bg-zinc-900 text-white overflow-hidden">
      <Canvas
        className="absolute inset-0"
        camera={{ position: [40, 40, 40], fov: 60 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#171717"]} />
        <hemisphereLight intensity={0.9} />
        <directionalLight position={[100, 100, 100]} />
        {curve && (
          <mesh>
            <tubeGeometry args={[curve, 600, 1, 8, false]} />
            <meshStandardMaterial color="#00ffff" />
          </mesh>
        )}
        <OrbitControls makeDefault enableDamping dampingFactor={0.12} />
        {points.length > 1 && (
          <FitCameraToPoints points={points} padding={1.25} />
        )}
      </Canvas>

      <div className="absolute top-4 left-4 z-10 bg-black/70 backdrop-blur-sm p-4 rounded-md shadow-lg">
        <form onSubmit={uploadFile} className="space-y-2">
          <div className="text-sm opacity-80">Upload GPX</div>
          <input
            name="file"
            type="file"
            accept=".gpx"
            className="block w-64 text-xs"
          />
          <button className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-md">
            Upload
          </button>
        </form>
        {route?.stats?.distance_km && (
          <div className="mt-2 text-xs opacity-80">
            {route.stats.distance_km} km
          </div>
        )}
      </div>
    </div>
  );
}
