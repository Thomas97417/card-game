import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { FOUNDRY } from "@sylve/game/foundry";
import { aimAtFoundry, fitFoundryCamera, foundryViewport, nudgeFoundryAim, pickFoundryGolem } from "./foundry-projection";

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
  it("selects a visible golem head even when a worktop-only ray would miss its feet",()=>{
    for(const [width,height] of [[1280,720],[390,844]]) {
      const viewport=foundryViewport(width!,height!),camera=new THREE.PerspectiveCamera(39,1,.1,100);fitFoundryCamera(camera,viewport);
      const root=new THREE.Group(),geometry=new THREE.SphereGeometry(.22,12,8),material=new THREE.MeshBasicMaterial();
      const head=new THREE.Mesh(geometry,material);head.position.y=1.05;root.add(head);root.updateMatrixWorld(true);
      const point=new THREE.Vector3(0,1.05,0).project(camera),x=viewport.left+(point.x+1)/2*viewport.width,y=viewport.top+(1-point.y)/2*viewport.height;
      const floor=aimAtFoundry(x,y,{left:0,top:0},viewport,camera);expect(Math.hypot(floor.x,floor.z)).toBeGreaterThan(.72);
      expect(pickFoundryGolem(x,y,{left:0,top:0},viewport,camera,[root])).toBe(root);
      expect(pickFoundryGolem(0,0,{left:0,top:0},viewport,camera,[root])).toBeUndefined();
      for(const edgeX of [-5.6,5.6])for(const edgeZ of [-3.4,3.4]){const top=new THREE.Vector3(edgeX,1.3,edgeZ).project(camera);expect(Math.abs(top.x)).toBeLessThan(.941);expect(Math.abs(top.y)).toBeLessThan(.941);}
      geometry.dispose();material.dispose();
    }
  });
  it("keeps keyboard directions correct after portrait rotation and clamps at the edges", () => {
    const input = { x: 0, z: 0, active: false };
    expect(nudgeFoundryAim(input, 0.28, 0, false)).toMatchObject({ x: 0.28, z: 0, active: true });
    expect(nudgeFoundryAim(input, 0.28, 0, true)).toMatchObject({ x: 0, z: -0.28, active: true });
    expect(nudgeFoundryAim(input, 0, 0.28, true)).toMatchObject({ x: 0.28, z: 0, active: true });
    expect(nudgeFoundryAim(input, 100, 100, false)).toMatchObject({ x: 5.6, z: 3.4 });
  });
});
