import { describe, expect, it } from "vitest";
import { FOUNDRY_SKILLS, FOUNDRY_SKILL_IDS, type FoundrySkillId } from "@sylve/game/foundry";
import { FOUNDRY_TREE, FOUNDRY_TREE_POINTS, boundTreeView, fitTreeView, visibleFoundrySkills, zoomTreeView } from "./foundry-tree-model";

describe("la découverte du grand arbre", () => {
  it("starts with all five entrances and reveals only the immediate learnable frontier", () => {
    const roots = visibleFoundrySkills([]);
    expect(roots).toHaveLength(5); expect(new Set(roots.map((id) => FOUNDRY_SKILLS[id].branch)).size).toBe(5);
    const first = visibleFoundrySkills(["forge-grip"]);
    expect(first).toHaveLength(7); expect(first).toContain("forge-first"); expect(first).toContain("forge-crit");
    expect(first).not.toContain("forge-crushing"); expect(first).not.toContain("sap-recovery"); expect(first).not.toContain("forge-mastery");
  });
  it("requires both converging paths before revealing a keystone, then hides them again on a new chantier", () => {
    const onePath: FoundrySkillId[] = ["forge-grip", "forge-first", "forge-crit", "forge-crushing"];
    expect(visibleFoundrySkills(onePath)).not.toContain("forge-mastery");
    expect(visibleFoundrySkills([...onePath, "forge-finisher"])).toContain("forge-mastery");
    expect(visibleFoundrySkills(FOUNDRY_SKILL_IDS)).toHaveLength(30); expect(visibleFoundrySkills([])).toHaveLength(5);
  });
  it("keeps every node inside the world and separates the five branches", () => {
    const points = Object.values(FOUNDRY_TREE_POINTS); expect(points).toHaveLength(30);
    for (const p of points) { expect(p.x).toBeGreaterThan(60); expect(p.y).toBeGreaterThan(60); expect(p.x).toBeLessThan(FOUNDRY_TREE.width - 60); expect(p.y).toBeLessThan(FOUNDRY_TREE.height - 60); }
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) expect(Math.hypot(points[i]!.x - points[j]!.x, points[i]!.y - points[j]!.y)).toBeGreaterThan(120);
  });
  it("anchors zoom beneath the pointer and clamps its bounds without numerical drift", () => {
    const view = { x: -300, y: -400, scale: 0.8 }, anchor = { x: 250, y: 220 }, zoomed = zoomTreeView(view, 1.6, anchor);
    expect((anchor.x - zoomed.x) / zoomed.scale).toBeCloseTo((anchor.x - view.x) / view.scale);
    expect((anchor.y - zoomed.y) / zoomed.scale).toBeCloseTo((anchor.y - view.y) / view.scale);
    expect(zoomTreeView(view, 100, anchor).scale).toBe(FOUNDRY_TREE.maxScale);
    expect(zoomTreeView(view, 0.001, anchor).scale).toBe(FOUNDRY_TREE.minScale);
    const back = zoomTreeView(zoomed, view.scale, anchor); expect(back.x).toBeCloseTo(view.x); expect(back.y).toBeCloseTo(view.y);
  });
  it("fits the discovered tree on desktop and mobile and bounds extreme drags", () => {
    for (const size of [{ width: 950, height: 510 }, { width: 350, height: 340 }]) {
      const ids = visibleFoundrySkills([]), fitted = fitTreeView(ids, size);
      for (const id of ids) { const p = FOUNDRY_TREE_POINTS[id]; expect(p.x * fitted.scale + fitted.x).toBeGreaterThan(25); expect(p.x * fitted.scale + fitted.x).toBeLessThan(size.width - 25); expect(p.y * fitted.scale + fitted.y).toBeGreaterThan(25); expect(p.y * fitted.scale + fitted.y).toBeLessThan(size.height - 25); }
      const bounded = boundTreeView({ x: 1e9, y: -1e9, scale: 1 }, size); expect(bounded.x).toBeLessThanOrEqual(180); expect(bounded.y).toBeGreaterThan(-FOUNDRY_TREE.height);
    }
  });
});
