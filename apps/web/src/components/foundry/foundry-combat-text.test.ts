import { describe, expect, it } from "vitest";
import type { FoundryImpact } from "@sylve/game/foundry";
import { createFoundryCombatText, mergeFoundryImpacts } from "./foundry-combat-text";
const hit: FoundryImpact = { x: 1, z: 2, targetId: 1, kind: "urn", damage: 3.45, critical: false, broken: true, loot: 7 };
const project = (x: number, z: number) => ({ x: x * 100, y: z * 100, visible: true });
describe("les chiffres à l’impact", () => {
  it("combines simultaneous techniques per relic without modifying the simulation impacts", () => {
    const hits = [hit, { ...hit, damage: 2, critical: true, broken: false, loot: 4 }, { ...hit, targetId: 2, damage: 1 }];
    const before = structuredClone(hits);
    expect(mergeFoundryImpacts(hits)).toEqual([
      { ...hit, damage: 5.45, loot: 11, critical: true },
      { ...hit, targetId: 2, damage: 1 },
    ]);
    expect(hits).toEqual(before);
  });
  it("shows damage and earned shards separately, with a distinct critical", () => {
    const host = document.createElement("div"), text = createFoundryCombatText(host, 8);
    text.impact(hit); text.impact({ ...hit, critical: true, damage: 6.9, loot: 0 }); text.render(0, project, false);
    expect(host.querySelector(".is-damage")?.textContent).toBe("3,45"); expect(host.querySelector(".is-loot")?.textContent).toBe("+7 ◇"); expect(host.querySelector(".is-critical")?.textContent).toBe("6,9 !");
    expect(host.querySelector<HTMLElement>(".is-damage")?.style.transform).not.toBe(host.querySelector<HTMLElement>(".is-loot")?.style.transform);
    text.destroy(); expect(host.children).toHaveLength(0);
  });
  it("keeps large full-build damage and loot compact while retaining small-hit precision", () => {
    const host = document.createElement("div"), text = createFoundryCombatText(host, 8);
    text.impact({ ...hit, damage: 23564.12, loot: 17296 }); text.render(0, project, false);
    expect(host.querySelector(".is-damage")?.textContent).toMatch(/23,6\s*k/);
    expect(host.querySelector(".is-loot")?.textContent).toMatch(/\+17,3\s*k/);
    text.destroy();
  });
  it("bounds the pool, respects pause and reduced motion, then expires its labels", () => {
    const host = document.createElement("div"), text = createFoundryCombatText(host, 6);
    for (let i = 0; i < 100; i++) text.impact({ ...hit, loot: 0 });
    expect(host.querySelectorAll(".foundry-hit-number")).toHaveLength(6);
    text.render(0.1, project, true); const label = host.querySelector<HTMLElement>(".foundry-hit-number")!, before = label.style.transform;
    text.render(0, project, true); expect(label.style.transform).toBe(before);
    text.render(0.1, project, true); expect(label.style.transform).toBe(before);
    text.render(2, project, true); expect([...host.querySelectorAll<HTMLElement>(".foundry-hit-number")].every((n) => n.hidden)).toBe(true);
    text.impact(hit); text.clear(); expect([...host.querySelectorAll<HTMLElement>(".foundry-hit-number")].every((n) => n.hidden)).toBe(true); text.destroy();
  });
});
