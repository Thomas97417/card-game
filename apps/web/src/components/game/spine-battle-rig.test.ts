import { afterEach, describe, expect, it } from "vitest";
import { gsap } from "gsap";
import { createSpineActor, createSpineBattleRig } from "./spine-battle-rig";
import { combatActorKey } from "./combat-visuals";
import { spineRigData } from "./spine-rig-data";
import type { RigProfile } from "./combat-rig-profile";
import { Physics, Skeleton } from "@esotericsoftware/spine-core";

afterEach(() => { gsap.ticker.sleep(); document.body.replaceChildren(); });

describe("Spine portrait rig", () => {
  it.each<RigProfile>(["humanoid", "quadruped", "winged", "avian", "serpent", "plant", "spirit"])(
    "reconstructs the source art exactly from the weighted %s bind pose", (profile) => {
      const { data, mesh, height } = spineRigData(profile);
      const skeleton = new Skeleton(data);
      skeleton.updateWorldTransform(Physics.none);
      const points = new Float32Array(mesh.worldVerticesLength);
      mesh.computeWorldVertices(skeleton.slots[0]!, 0, points.length, points, 0, 2);
      for (let vertex = 0; vertex < points.length / 2; vertex++) {
        expect(points[vertex * 2]).toBeCloseTo((mesh.regionUVs[vertex * 2]! - 0.5) * 100, 4);
        expect(points[vertex * 2 + 1]).toBeCloseTo((1 - mesh.regionUVs[vertex * 2 + 1]!) * height, 4);
      }
      expect(data.bones.length).toBeGreaterThan(5);
      expect(mesh.triangles).toHaveLength(12 * 14 * 6);
    },
  );

  it("articulates the head, elbows and knees independently instead of transforming a flat portrait", () => {
    const actor = createSpineActor(document.createElement("span"));
    actor.pose("melee", 0.26);
    const skeleton = actor.skeleton;
    expect(skeleton.findBone("arm-1")!.rotation).toBeCloseTo(32);
    expect(skeleton.findBone("forearm-1")!.rotation).toBeCloseTo(30);
    expect(skeleton.findBone("leg1")!.rotation).toBeCloseTo(-13);
    expect(skeleton.findBone("head")!.rotation).toBeCloseTo(7);
    const rest = new Skeleton(skeleton.data);
    rest.updateWorldTransform(Physics.none);
    const setup = new Float32Array(actor.attachment.worldVerticesLength);
    const posed = new Float32Array(setup.length);
    actor.attachment.computeWorldVertices(rest.slots[0]!, 0, setup.length, setup, 0, 2);
    actor.attachment.computeWorldVertices(skeleton.slots[0]!, 0, posed.length, posed, 0, 2);
    expect(posed.some((value, index) => Math.abs(value - setup[index]!) > 4)).toBe(true);
    expect(posed.every(Number.isFinite)).toBe(true);
    actor.destroy();
  });

  it("inherits the body bone matrix, mirrors reactions and blends back to breathing", () => {
    const left = document.createElement("span");
    const right = document.createElement("span");
    const a = createSpineActor(left, 1);
    const b = createSpineActor(right, -1);
    a.pose("hit");
    b.pose("hit");
    a.update(0.035);
    b.update(0.035);
    const matrix = (node: HTMLElement) => node.style.transform.match(/matrix\(([^)]+)\)/)![1]!.split(",").map(Number);
    expect(matrix(left)[0]).toBeGreaterThan(1);
    expect(matrix(left)[1]).toBeLessThan(0);
    expect(matrix(right)[1]).toBeGreaterThan(0);
    expect(matrix(right)[1]).toBeCloseTo(-matrix(left)[1]!);
    for (let index = 0; index < 30; index++) a.update(0.05);
    expect(matrix(left)[0]).toBeCloseTo(1, 1);
    expect(Math.abs(matrix(left)[1]!)).toBeLessThan(0.02);
    a.destroy(); b.destroy();
    expect(left.style.transform).toBe("");
    expect(right.style.transform).toBe("");
  });

  it("keeps identical cards independent, handles replaced portraits and leaves buildings still", async () => {
    const arena = document.createElement("section");
    arena.dataset.combatViewer = "0";
    document.body.appendChild(arena);
    function control(row: number, building = false) {
      const button = document.createElement("button");
      button.dataset.combatActor = combatActorKey({ player: 0, cardId: "fox", row, depth: 0 });
      button.dataset.combatStatic = String(building);
      button.innerHTML = '<span data-combat-rig></span>';
      arena.appendChild(button);
      return button;
    }
    const first = control(0);
    const second = control(1);
    const building = control(2, true);
    const rig = createSpineBattleRig(arena);
    gsap.ticker.sleep();
    const firstBody = first.firstElementChild as HTMLElement;
    const secondBody = second.firstElementChild as HTMLElement;
    const untouched = secondBody.style.transform;
    rig.pose({ player: 0, cardId: "fox", row: 0, depth: 0 }, "hit", 0.035);
    expect(firstBody.style.transform).not.toBe(untouched);
    expect(secondBody.style.transform).toBe(untouched);
    rig.pose({ player: 0, cardId: "fox", row: 2, depth: 0 }, "hit", 0.035);
    expect((building.firstElementChild as HTMLElement).style.transform).toBe("");
    first.innerHTML = '<span data-combat-rig></span>';
    await Promise.resolve();
    expect(firstBody.style.transform).toBe("");
    const replacement = first.firstElementChild as HTMLElement;
    rig.pose({ player: 0, cardId: "fox", row: 0, depth: 0 }, "hit", 0.035);
    expect(replacement.style.transform).toContain("matrix");
    rig.destroy(); rig.destroy();
    expect(replacement.style.transform).toBe("");
    expect(arena.dataset.combatRig).toBeUndefined();
  });
});
