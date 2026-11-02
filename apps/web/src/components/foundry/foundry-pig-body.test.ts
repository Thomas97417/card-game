import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFoundryPigBody, PIG_FOOT_CENTERS } from './foundry-pig-body';

describe('le corps et les pieds sculptés des cochons', () => {
  for (const mobile of [false, true]) it(`keeps all four feet on one connected surface (${mobile ? 'mobile' : 'desktop'})`, () => {
    const geometry = createFoundryPigBody(mobile), positions = geometry.getAttribute('position');
    const vertices = new Map<string, number>(), parents: number[] = [];
    const find = (id: number): number => parents[id] === id ? id : parents[id] = find(parents[id]!);
    for (let triangle = 0; triangle < positions.count; triangle += 3) {
      const ids = [0, 1, 2].map(offset => {
        const i = triangle + offset;
        const key = [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => Math.round(v * 1e5)).join(':');
        if (!vertices.has(key)) { vertices.set(key, parents.length); parents.push(parents.length); }
        return vertices.get(key)!;
      });
      for (const id of ids) parents[find(id)] = find(ids[0]!);
    }
    expect(new Set(parents.map((_, id) => find(id))).size).toBe(1);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material);
    mesh.updateMatrixWorld(true);
    for (const foot of PIG_FOOT_CENTERS) {
      const ray = new THREE.Raycaster(new THREE.Vector3(foot.x, 2, foot.z), new THREE.Vector3(0, -1, 0));
      const heights = [...new Set(ray.intersectObject(mesh).map(hit => hit.point.y.toFixed(4)))].map(Number);
      // A detached foot would leave two extra crossings through the air gap.
      expect(heights).toHaveLength(2);
      expect(Math.min(...heights)).toBeCloseTo(.008, 2);
    }
    geometry.dispose(); material.dispose();
  });
});
