// === FitCameraToPoints.tsx (you can paste this in App.tsx too) ===
import * as THREE from "three";
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

/**
 * Auto-frames the active camera + OrbitControls to the given 3D points.
 * - Computes bounding sphere
 * - Positions camera back along its current direction so the object fits
 * - Updates OrbitControls target (if present)
 */
export function FitCameraToPoints({
  points,
  padding = 1.2, // extra space around the object (1.0 = tight)
  minDistance = 5, // don't let camera get too close
}: {
  points: THREE.Vector3[];
  padding?: number;
  minDistance?: number;
}) {
  const { camera, controls, size } = useThree() as any;

  useEffect(() => {
    if (!points || points.length === 0) return;

    // 1) Compute bounding sphere of the points
    const box = new THREE.Box3().setFromPoints(points);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);

    // If all points collapsed to one location, give it a small radius
    if (sphere.radius < 1e-3) sphere.radius = 1;

    // 2) Compute distance from sphere radius & camera FOV
    //    dist = r / sin(fov/2). Using tan also works when looking straight down the -Z axis.
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const dist = (sphere.radius * padding) / Math.sin(fov / 2);

    // 3) Choose a viewing direction (from current camera or a default)
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); // fallback

    // 4) Position the camera so the sphere fits in view
    const newPos = sphere.center.clone().add(dir.multiplyScalar(-dist));
    camera.position.copy(newPos);

    // 5) Update near/far and look-at
    camera.near = Math.max(0.1, dist / 100);
    camera.far = dist * 10;
    camera.updateProjectionMatrix();

    // 6) Center OrbitControls on the object if available
    if (controls) {
      controls.target.copy(sphere.center);
      controls.update();
    } else {
      camera.lookAt(sphere.center);
    }
  }, [points, camera, controls, size.width, size.height, padding, minDistance]);

  return null;
}
