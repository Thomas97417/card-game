import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { FOUNDRY } from "@sylve/game/foundry";
import { aimAtFoundry, fitFoundryCamera, foundryViewport, nudgeFoundryAim } from "./foundry-projection";

describe("l’établi intégré au décor", () => {
  for (const [width, height] of [[1030, 900], [1600, 1000], [390, 844], [760, 560]]) {
    it(`keeps the whole board visible and pointer hits aligned at ${width} × ${height}`, () => {
      const viewport = foundryViewport(width!, height!);
      const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 100);
      fitFoundryCamera(camera, viewport);
      for (const x of [-FOUNDRY.width / 2, 0, FOUNDRY.width / 2]) for (const z of [-FOUNDRY.depth / 2, 0, FOUNDRY.depth / 2]) {
        const projected = new THREE.Vector3(x, 0, z).project(camera);
        expect(Math.abs(projected.x)).toBeLessThanOrEqual(0.941);
        expect(Math.abs(projected.y)).toBeLessThanOrEqual(0.941);
        const input = aimAtFoundry(23 + viewport.left + (projected.x + 1) / 2 * viewport.width,
          37 + viewport.top + (1 - projected.y) / 2 * viewport.height, { left: 23, top: 37 }, viewport, camera);
        expect(input.x).toBeCloseTo(x, 6); expect(input.z).toBeCloseTo(z, 6);
        // Exact boundary round-trips may differ by floating-point epsilon.
        if (x === 0 && z === 0) expect(input.active).toBe(true);
      }
      expect(aimAtFoundry(width! / 2, 10, { left: 0, top: 0 }, viewport, camera).active).toBe(false);
    });
  }
  it("uses a much larger region and gives portrait the long side of the board", () => {
    const desktop = foundryViewport(1030, 900);
    expect(desktop.width * desktop.height).toBeGreaterThan(550000);
    expect(foundryViewport(390, 844).portrait).toBe(true);
    expect(foundryViewport(1030, 900).portrait).toBe(false);
  });
  it("keeps keyboard directions correct after portrait rotation and clamps at the edges", () => {
    const input = { x: 0, z: 0, active: false };
    expect(nudgeFoundryAim(input, 0.28, 0, false)).toMatchObject({ x: 0.28, z: 0, active: true });
    expect(nudgeFoundryAim(input, 0.28, 0, true)).toMatchObject({ x: 0, z: -0.28, active: true });
    expect(nudgeFoundryAim(input, 0, 0.28, true)).toMatchObject({ x: 0.28, z: 0, active: true });
    expect(nudgeFoundryAim(input, 100, 100, false)).toMatchObject({ x: 5.6, z: 3.4 });
  });
});
