import * as THREE from "three";
import { FOUNDRY, type FoundryInput } from "@sylve/game/foundry";

export interface FoundryViewport {
  left: number;
  top: number;
  width: number;
  height: number;
  portrait: boolean;
}

/** Reserve only the top band for the HUD; the painted foreground is playable. */
export function foundryViewport(width: number, height: number): FoundryViewport {
  const portrait = width < 700 && height > width;
  return {
    left: width * 0.02,
    top: height * (portrait ? 0.29 : 0.28),
    width: width * 0.96,
    height: height * (portrait ? 0.65 : 0.66),
    portrait,
  };
}

/** Fit the real collision plane, rather than a miniature room around it. */
export function fitFoundryCamera(camera: THREE.PerspectiveCamera, viewport: FoundryViewport) {
  camera.aspect = viewport.width / viewport.height;
  camera.updateProjectionMatrix();
  const direction = new THREE.Vector3(...(viewport.portrait ? [8, 18, 0] as const : [0, 16, 7] as const)).normalize();
  const corners = [-1, 1].flatMap((x) => [-1, 1].map((z) => new THREE.Vector3(x * FOUNDRY.width / 2, 0, z * FOUNDRY.depth / 2)));
  let near = 6;
  let far = 60;
  for (let i = 0; i < 24; i++) {
    const distance = (near + far) / 2;
    camera.position.copy(direction).multiplyScalar(distance);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const fits = corners.every((corner) => {
      const projected = corner.clone().project(camera);
      return Math.abs(projected.x) <= 0.94 && Math.abs(projected.y) <= 0.94;
    });
    if (fits) far = distance;
    else near = distance;
  }
  camera.position.copy(direction).multiplyScalar(far);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera.position.clone();
}

export function aimAtFoundry(
  clientX: number,
  clientY: number,
  bounds: { left: number; top: number },
  viewport: FoundryViewport,
  camera: THREE.PerspectiveCamera,
): FoundryInput {
  const x = (clientX - bounds.left - viewport.left) / viewport.width;
  const y = (clientY - bounds.top - viewport.top) / viewport.height;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(x * 2 - 1, 1 - y * 2), camera);
  const point = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  const inside = !!point && x >= 0 && x <= 1 && y >= 0 && y <= 1
    && Math.abs(point.x) <= FOUNDRY.width / 2 && Math.abs(point.z) <= FOUNDRY.depth / 2;
  return {
    x: Math.max(-FOUNDRY.width / 2, Math.min(FOUNDRY.width / 2, point?.x ?? 0)),
    z: Math.max(-FOUNDRY.depth / 2, Math.min(FOUNDRY.depth / 2, point?.z ?? 0)),
    active: inside,
  };
}

/** Portrait uses the long side of the same board; arrows still follow the screen. */
export function nudgeFoundryAim(input: FoundryInput, dx: number, dz: number, portrait: boolean): FoundryInput {
  return {
    x: Math.max(-FOUNDRY.width / 2, Math.min(FOUNDRY.width / 2, input.x + (portrait ? dz : dx))),
    z: Math.max(-FOUNDRY.depth / 2, Math.min(FOUNDRY.depth / 2, input.z + (portrait ? -dx : dz))),
    active: true,
  };
}
