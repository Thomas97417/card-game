import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { TOOL_IDS } from "@sylve/game/foundry";
import { createFoundryArt } from "./foundry-art";
import { FOUNDRY_IMPACT_DELAY_MS, poseFoundryHammer } from "./foundry-hammer";

describe("la face de frappe du marteau", () => {
  it("changes the visible silhouette when a different hammer is equipped", () => {
    const art = createFoundryArt(true);
    try {
      const hammer = art.hammer();
      const sizes = new Map<string, THREE.Vector3>();
      for (const tool of TOOL_IDS) {
        hammer.tool(tool); hammer.root.updateMatrixWorld(true);
        const bounds = new THREE.Box3();
        hammer.root.traverseVisible((object) => { if (object instanceof THREE.Mesh) bounds.expandByObject(object); });
        sizes.set(tool, bounds.getSize(new THREE.Vector3()));
      }
      expect(new Set([...sizes.values()].map((size) => size.toArray().map((value) => value.toFixed(3)).join(","))).size).toBe(TOOL_IDS.length);
      expect(sizes.get("heavy")!.z).toBeGreaterThan(sizes.get("mallet")!.z * 1.4);
      expect(sizes.get("swift")!.z).toBeLessThan(sizes.get("mallet")!.z * 0.8);
      expect(sizes.get("spiked")!.x).toBeGreaterThan(sizes.get("mallet")!.x * 1.5);
    } finally { art.dispose(); }
  });
  for (const tool of TOOL_IDS) it(`${tool} lands its metal end on the aim at the sound/fragment frame`, () => {
    const art = createFoundryArt(true);
    try {
      const hammer = art.hammer(); hammer.tool(tool);
      for (const aim of [{ x: 0, z: 0, active: true }, { x: -4.5, z: 2.3, active: true }]) {
        poseFoundryHammer(hammer, aim, FOUNDRY_IMPACT_DELAY_MS);
        const contact = hammer.strikeFace.getWorldPosition(new THREE.Vector3());
        const normal = new THREE.Vector3(1, 0, 0).transformDirection(hammer.strikeFace.matrixWorld);
        expect(contact.x).toBeCloseTo(aim.x, 8); expect(contact.z).toBeCloseTo(aim.z, 8);
        expect(contact.y).toBeCloseTo(0.42, 8);
        expect(normal.x).toBeCloseTo(0, 8); expect(normal.y).toBeCloseTo(-1, 8); expect(normal.z).toBeCloseTo(0, 8);
        poseFoundryHammer(hammer, aim, 35);
        expect(hammer.strikeFace.getWorldPosition(new THREE.Vector3()).y).toBeGreaterThan(contact.y + 1);
        poseFoundryHammer(hammer, aim, 150);
        expect(hammer.strikeFace.getWorldPosition(new THREE.Vector3()).y).toBeGreaterThan(contact.y);
      }
    } finally { art.dispose(); }
  });
});
