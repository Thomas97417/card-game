import { FOUNDRY_SKILLS, LEGACY_FOUNDRY_SKILL_IDS, FOUNDRY_REFERENCE_SKILL_IDS, foundrySkill, foundrySkills, foundrySkillReady, FOUNDRY_BRANCH_IDS, type FoundryBranch, type FoundrySkillId } from "@sylve/game/foundry";

export interface TreePoint { x: number; y: number }
export interface TreeSize { width: number; height: number }
export interface TreeView extends TreePoint { scale: number }
export const FOUNDRY_TREE = { width: 3240, height: 2940, center: { x: 1620, y: 1390 }, minScale: 0.08, maxScale: 2.2 } as const;
const angles: Record<FoundryBranch, number> = { forge: -90, storm: -18, fortune: 54, sap: 126, echo: 198 };
const steps = [{ depth: 175, side: 0 }, { depth: 340, side: -92 }, { depth: 340, side: 92 }, { depth: 505, side: -135 }, { depth: 505, side: 135 }, { depth: 690, side: 0 }];

export function treeBranchPoint(branch: FoundryBranch, depth: number, side = 0): TreePoint {
  const angle = angles[branch] * Math.PI / 180;
  return { x: FOUNDRY_TREE.center.x + Math.cos(angle) * depth - Math.sin(angle) * side,
    y: FOUNDRY_TREE.center.y + Math.sin(angle) * depth + Math.cos(angle) * side };
}
export const FOUNDRY_TREE_POINTS = Object.fromEntries(FOUNDRY_BRANCH_IDS.flatMap((branch) =>
  LEGACY_FOUNDRY_SKILL_IDS.filter((id) => FOUNDRY_SKILLS[id].branch === branch).map((id, index) => [id, treeBranchPoint(branch, steps[index]!.depth, steps[index]!.side)])).concat(FOUNDRY_REFERENCE_SKILL_IDS.map((id) => { const point = foundrySkill(id).point!; return [id, { x: FOUNDRY_TREE.center.x + point.x * 170, y: FOUNDRY_TREE.center.y + point.y * 170 }]; }))) as Record<FoundrySkillId, TreePoint>;

/** Hidden nodes have no button, label or connection until all their parents are acquired. */
export function visibleFoundrySkills(owned: readonly FoundrySkillId[], economy = 3): FoundrySkillId[] {
  const learned = new Set(owned);
  return foundrySkills({ economy }).filter((id) => learned.has(id) || foundrySkillReady(id, owned));
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const treeScale = (scale: number) => clamp(scale, FOUNDRY_TREE.minScale, FOUNDRY_TREE.maxScale);
export function boundTreeView(view: TreeView, size: TreeSize): TreeView {
  const scale = treeScale(view.scale);
  const axis = (value: number, viewport: number, world: number) => {
    const margin = Math.min(180, viewport * 0.4), extent = world * scale;
    return extent + margin * 2 <= viewport ? (viewport - extent) / 2 : clamp(value, viewport - extent - margin, margin);
  };
  return { scale, x: axis(view.x, size.width, FOUNDRY_TREE.width), y: axis(view.y, size.height, FOUNDRY_TREE.height) };
}
export function zoomTreeView(view: TreeView, scale: number, anchor: TreePoint): TreeView {
  const next = treeScale(scale), ratio = next / view.scale;
  return { scale: next, x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio };
}
export function centerTreeView(view: TreeView, point: TreePoint, size: TreeSize): TreeView {
  return boundTreeView({ ...view, x: size.width / 2 - point.x * view.scale, y: size.height / 2 - point.y * view.scale }, size);
}
export function fitTreeView(ids: readonly FoundrySkillId[], size: TreeSize): TreeView {
  const points = [FOUNDRY_TREE.center, ...ids.map((id) => FOUNDRY_TREE_POINTS[id])];
  const left = Math.min(...points.map((p) => p.x)) - 90, right = Math.max(...points.map((p) => p.x)) + 90;
  const top = Math.min(...points.map((p) => p.y)) - 90, bottom = Math.max(...points.map((p) => p.y)) + 90;
  const scale = treeScale(Math.min(1.05, size.width / (right - left), size.height / (bottom - top)));
  return centerTreeView({ scale, x: 0, y: 0 }, { x: (left + right) / 2, y: (top + bottom) / 2 }, size);
}
export function treeConnection(from: TreePoint, to: TreePoint, fromRadius = 33, toRadius = 29): string {
  const distance = Math.max(0.001, Math.hypot(to.x - from.x, to.y - from.y)), dx = (to.x - from.x) / distance, dy = (to.y - from.y) / distance;
  return `M ${from.x + dx * fromRadius} ${from.y + dy * fromRadius} L ${to.x - dx * toRadius} ${to.y - dy * toRadius}`;
}
