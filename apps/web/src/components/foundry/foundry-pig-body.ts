import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

export const PIG_FOOT_CENTERS = [-1, 1].flatMap(side => [-1, 1].map(end => ({
  side, end, x: side * .24, z: end * .245,
})));

const smoothUnion = (a: number, b: number, radius: number) => {
  const h = Math.max(radius - Math.abs(a - b), 0) / radius;
  return Math.min(a, b) - h * h * radius * .25;
};

/** One continuous surface: short, flared feet blend into the ceramic belly without seams or gaps. */
export function createFoundryPigBody(mobile: boolean): THREE.BufferGeometry {
  const resolution = mobile ? 36 : 56;
  const material = new THREE.MeshBasicMaterial();
  const surface = new MarchingCubes(resolution, material, false, false, 20000);
  surface.isolation = 0;
  for (let z = 0; z < resolution; z++) for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
    const px = (x / resolution * 2 - 1) * .62;
    const py = (y / resolution * 2 - 1) * .65 + .5;
    const pz = (z / resolution * 2 - 1) * .66;
    let distance = (Math.hypot(px / .445, (py - .56) / .445, (pz + .025) / .48) - 1) * .445;
    for (const foot of PIG_FOOT_CENTERS) {
      const t = THREE.MathUtils.clamp((py - .07) / .30, 0, 1);
      const radius = THREE.MathUtils.lerp(.105, .155, t * t * (3 - 2 * t));
      const centerY = THREE.MathUtils.clamp(py, .07, .37);
      const leg = Math.max(Math.hypot(px - foot.x, py - centerY, pz - foot.z) - radius, .008 - py);
      distance = smoothUnion(distance, leg, .075);
    }
    surface.setCell(x, y, z, -distance);
  }
  surface.update();
  const geometry = new THREE.BufferGeometry();
  geometry.name = 'pig-belly-and-feet';
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(surface.positionArray.slice(0, surface.count * 3), 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(surface.normalArray.slice(0, surface.count * 3), 3));
  geometry.scale(.62, .65, .66); geometry.translate(0, .5, 0);
  const positions = geometry.getAttribute('position'), uvs = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i) - .56, z = positions.getZ(i);
    uvs[i * 2] = .5 + Math.atan2(x, z) / (2 * Math.PI);
    uvs[i * 2 + 1] = .5 + Math.atan2(y, Math.hypot(x, z)) / Math.PI;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  surface.geometry.dispose(); material.dispose();
  return geometry;
}
