import { afterEach, describe, expect, it } from "vitest";
import { gsap } from "gsap";
import { createSpineActor, createSpineBattleRig } from "./spine-battle-rig";
import { combatActorKey } from "./combat-visuals";

afterEach(() => { gsap.ticker.sleep(); document.body.replaceChildren(); });

describe("Spine portrait rig", () => {
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
