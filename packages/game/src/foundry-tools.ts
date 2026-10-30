/** Numeric hammer reference: Bills Must Be Paid, build 24759944 (docs/references). */
export const TOOL_IDS = ["mallet", "swift", "precision", "resonance", "heavy", "spiked", "gilded"] as const;
export const LEGACY_TOOL_IDS = ["mallet", "swift", "resonance", "heavy", "precision", "gilded"] as const;
export type FoundryTool = (typeof TOOL_IDS)[number];
export interface FoundryToolDefinition {
  name: string; detail: string; damage: number; interval: number; radius: number; cadence: number;
  cost: number; stamina: number; critical: number; criticalDamage: number; loot: number; source: string;
}
const defineTool = (spec: Pick<FoundryToolDefinition, "name" | "detail"> & Partial<FoundryToolDefinition>): FoundryToolDefinition =>
  ({ damage: 1, interval: 11, radius: 0.72, cadence: 0, cost: 0, stamina: 1, critical: 0, criticalDamage: 0, loot: 0, source: "hammers/basic-hammer", ...spec });
export const TOOLS: Record<FoundryTool, FoundryToolDefinition> = {
  mallet: defineTool({ name: "Maillet de cuivre", detail: "Le marteau de départ, sans modificateur" }),
  swift: defineTool({ name: "Martelet vif", detail: "+2 dégâts, +35 % de cadence et +0,3 de portée", damage: 3, cadence: 0.35, radius: 1.02, cost: 1000, source: "hammers/toy-hammer" }),
  precision: defineTool({ name: "Marteau du graveur", detail: "+4 dégâts, +15 points de critiques, +60 % de dégâts critiques, +10 % de cadence et −0,3 de portée", damage: 5, cadence: 0.1, radius: 0.42, cost: 4000, critical: 0.15, criticalDamage: 0.6, source: "hammers/ultra-crit" }),
  resonance: defineTool({ name: "Marteau à panne", detail: "+20 dégâts, +15 % de cadence et −0,2 stamina par coup", damage: 21, cadence: 0.15, cost: 50000, stamina: 0.8, source: "hammers/cross-peen-hammer" }),
  heavy: defineTool({ name: "Brise-roche", detail: "+44 dégâts et +0,6 stamina par coup", damage: 45, cost: 250000, stamina: 1.6, source: "hammers/heavy-hammer" }),
  spiked: defineTool({ name: "Marteau à pointes", detail: "+89 dégâts, +20 % de dégâts critiques et +0,7 stamina par coup", damage: 90, cost: 1000000, stamina: 1.7, criticalDamage: 0.2, source: "hammers/spiked-hammer" }),
  gilded: defineTool({ name: "Marteau d’ambre", detail: "+150 dégâts, +20 points de critiques et +25 % de dégâts critiques", damage: 151, cost: 10000000, critical: 0.2, criticalDamage: 0.25, source: "hammers/golden-hammer" }),
};
/** Complete old profiles keep existing chantiers and saved strike costs unchanged. */
export const LEGACY_TOOLS = {
  mallet: defineTool({ name: "Maillet de cuivre", detail: "Une frappe solide et équilibrée" }),
  swift: defineTool({ name: "Martelet vif", detail: "Léger, précis et très rapide", damage: 1.8, interval: 5, radius: 0.55, cost: 120, source: "hammers/toy-hammer" }),
  resonance: defineTool({ name: "Marteau de résonance", detail: "Une onde qui touche les objets voisins", damage: 2.4, interval: 16, radius: 1.65, cost: 260, source: "skill-tree/smash-hit-radius" }),
  heavy: defineTool({ name: "Brise-roche", detail: "Une tête massive, des coups puissants, plus d’endurance dépensée", damage: 3, interval: 16, radius: 0.9, cost: 80, stamina: 1.4, source: "hammers/heavy-hammer" }),
  precision: defineTool({ name: "Marteau du graveur", detail: "+15 points de critiques et +60 % de dégâts critiques", damage: 2.2, interval: 8, radius: 0.58, cost: 180, critical: 0.15, criticalDamage: 0.6, source: "hammers/ultra-crit" }),
  gilded: defineTool({ name: "Marteau d’ambre", detail: "+25 % d’éclats sur les reliques, une frappe ample et puissante", damage: 4, interval: 12, radius: 1.1, cost: 420, stamina: 1.2, loot: 0.25, source: "hammers/golden-hammer" }),
};
export function legacyFoundryTool(tool: FoundryTool): FoundryToolDefinition {
  return tool === "spiked" ? TOOLS.spiked : LEGACY_TOOLS[tool];
}
export function foundryTools(cycle: { economy?: number }): readonly FoundryTool[] {
  return (cycle.economy ?? 0) >= 3 ? TOOL_IDS : LEGACY_TOOL_IDS;
}
export function foundryToolDefinition(cycle: { economy?: number }, tool: FoundryTool): FoundryToolDefinition {
  return (cycle.economy ?? 0) >= 3 ? TOOLS[tool] : legacyFoundryTool(tool);
}
