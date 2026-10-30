import { FOUNDRY_REFERENCE_SKILLS, FOUNDRY_REFERENCE_SKILL_IDS, FOUNDRY_REFERENCE_MODIFIERS, type FoundryReferenceModifiers } from "./foundry-skill-reference";
export * from "./foundry-skill-reference";
/** Sylve balance, adapted from the versioned numeric reference in docs/references. */
export const FOUNDRY_MODIFIERS = {
  power: 0, cadence: 0, focus: 0, radius: 0, loot: 0, critical: 0, criticalDamage: 0, drain: 0,
  recoveryChance: 0, recoveryAmount: 0, springRecovery: 0, firstKillRecovery: 0, firstHitBonus: 0,
  execute: 0, criticalLoot: 0, geodeLoot: 0, jackpotChance: 0, oneShotLoot: 0, damageGrowth: 0, lootGrowth: 0,
  capacity: 0, freezeChance: 0, freezeDamage: 0, berserkChance: 0, berserkDuration: 0,
  lightningChance: 0, lightningDamage: 0, lightningTargets: 0, burnChance: 0, burnDamage: 0,
  shockwaveChance: 0, shockwaveDamage: 0, shockwaveRadius: 0, chainChance: 0, chainDamage: 0, firstWave: 0,
};
export type FoundryModifiers = { [K in keyof typeof FOUNDRY_MODIFIERS]: number };
export const FOUNDRY_BRANCH_IDS = ["forge", "sap", "storm", "fortune", "echo"] as const;
export type FoundryBranch = (typeof FOUNDRY_BRANCH_IDS)[number];
export const FOUNDRY_BRANCHES = {
  forge: { name: "La Forge", detail: "Frappes décisives et critiques", symbol: "◆", color: "#deaa6e" },
  sap: { name: "La Sève", detail: "Concentration et récupération", symbol: "❋", color: "#9ecb8b" },
  storm: { name: "L’Orage", detail: "Cadence, foudre et braises", symbol: "ϟ", color: "#9ac7dc" },
  fortune: { name: "L’Ambre", detail: "Butin, jackpots et précision", symbol: "✦", color: "#edcb74" },
  echo: { name: "Les Échos", detail: "Portée et réactions en chaîne", symbol: "◎", color: "#bda2d4" },
} as const;
export interface FoundrySkill {
  branch: FoundryBranch; name: string; detail: string; cost: number; requires: string[];
  effects: Partial<FoundryModifiers>; source: string;
  requiresAny?: string[]; kind?: "upgrade" | "passive" | "technique"; reference?: Partial<FoundryReferenceModifiers>;
  originalName?: string; point?: { x: number; y: number }; adaptation?: string;
}
const skill = (branch: FoundryBranch, name: string, detail: string, cost: number, requires: string[], effects: Partial<FoundryModifiers>, source: string): FoundrySkill => ({ branch, name, detail, cost, requires, effects, source });
export const LEGACY_FOUNDRY_SKILLS = {
  "forge-grip": skill("forge", "Poigne de cuivre", "+20 % de dégâts.", 30, [], { power: 0.2 }, "skill-tree/smash-damage-1"),
  "forge-first": skill("forge", "Premier éclat", "+35 % de dégâts sur une relique intacte.", 60, ["forge-grip"], { firstHitBonus: 0.35 }, "skill-tree/first-hit-multiplier"),
  "forge-crit": skill("forge", "Frappe précise", "+5 points de chance critique.", 60, ["forge-grip"], { critical: 0.05 }, "street-smarts/crit-chance"),
  "forge-crushing": skill("forge", "Brise-sceau", "+65 % de dégâts supplémentaires sur une relique intacte.", 120, ["forge-first"], { firstHitBonus: 0.65 }, "skill-tree/first-hit-damage-2"),
  "forge-finisher": skill("forge", "Dernier écho", "Un critique achève les reliques à 10 % de vie ou moins.", 120, ["forge-crit"], { execute: 0.1 }, "street-smarts/finisher"),
  "forge-mastery": skill("forge", "Cœur du forgeron", "+30 % de dégâts et +35 % de dégâts critiques.", 240, ["forge-crushing", "forge-finisher"], { power: 0.3, criticalDamage: 0.35 }, "street-smarts/crit-power"),
  "sap-breath": skill("sap", "Souffle des fougères", "+15 % de concentration maximale.", 30, [], { focus: 0.15 }, "skill-tree/endurance-stamina-1"),
  "sap-recovery": skill("sap", "Sève retrouvée", "Chaque relique brisée a 10 % de chance de rendre jusqu’à 3 points de concentration.", 60, ["sap-breath"], { recoveryChance: 0.1, recoveryAmount: 1 }, "skill-tree/endurance-siphon-1"),
  "sap-spring": skill("sap", "Réserves profondes", "+10 % de concentration maximale.", 60, ["sap-breath"], { focus: 0.1 }, "skill-tree/endurance-stamina-1"),
  "sap-second": skill("sap", "Seconde sève", "La première relique brisée d’une manche rend 10 points de concentration.", 120, ["sap-recovery"], { firstKillRecovery: 10 }, "prestige-items/recovery-ring"),
  "sap-flow": skill("sap", "Respiration calme", "Chaque frappe consomme 15 % de stamina en moins.", 120, ["sap-spring"], { drain: -0.15 }, "skill-tree/endurance-cost-1"),
  "sap-heart": skill("sap", "Cœur de la Sylve", "+20 % de concentration maximale et +10 points de chance de récupération.", 240, ["sap-second", "sap-flow"], { focus: 0.2, recoveryChance: 0.1 }, "skill-tree/endurance-stamina-recovery-on-destroy"),
  "storm-tempo": skill("storm", "Danse des braises", "+12 % de vitesse de frappe.", 30, [], { cadence: 0.12 }, "skill-tree/frenzy-speed-1"),
  "storm-lightning": skill("storm", "Arc de cuivre", "12 % de chance par frappe de toucher 2 autres reliques avec la foudre : 45 % des dégâts de base.", 60, ["storm-tempo"], { lightningChance: 0.12, lightningDamage: 0.45 }, "skill-tree/frenzy-blitz"),
  "storm-burn": skill("storm", "Braises tenaces", "15 % de chance d’embraser la cible pendant 3 s : 20 % des dégâts de base toutes les 0,5 s.", 60, ["storm-tempo"], { burnChance: 0.15, burnDamage: 0.2 }, "skill-tree/ignite-chance-1"),
  "storm-chain": skill("storm", "Foudre ramifiée", "La foudre touche 2 cibles supplémentaires et gagne 20 % des dégâts de base.", 120, ["storm-lightning"], { lightningTargets: 2, lightningDamage: 0.2 }, "skill-tree/frenzy-blitz-chains"),
  "storm-fury": skill("storm", "Fureur du foyer", "Chaque destruction a 6 % de chance de déclencher 3 s de fureur : +20 % de dégâts, +50 % de cadence, coût en stamina par frappe divisé par deux.", 120, ["storm-burn"], { berserkChance: 0.06 }, "street-smarts/berserk"),
  "storm-tempest": skill("storm", "Tempête d’échos", "+12 points de chance de foudre ; la fureur dure 1 s de plus.", 240, ["storm-chain", "storm-fury"], { lightningChance: 0.12, berserkDuration: 20 }, "skill-tree/frenzy-blitz-3"),
  "fortune-touch": skill("fortune", "Main d’ambre", "+12 % d’éclats sur chaque relique.", 30, [], { loot: 0.12 }, "skill-tree/fortune-loot-1"),
  "fortune-critical": skill("fortune", "Critique doré", "Les destructions critiques rapportent 12 % d’éclats supplémentaires.", 60, ["fortune-touch"], { criticalLoot: 0.12 }, "street-smarts/crit-bonus"),
  "fortune-geode": skill("fortune", "Filons anciens", "Les géodes rapportent 30 % d’éclats supplémentaires.", 60, ["fortune-touch"], { geodeLoot: 0.3 }, "piggies/rocky"),
  "fortune-lucky": skill("fortune", "Éclat chanceux", "5 % de chance de doubler le butin d’une relique.", 120, ["fortune-critical"], { jackpotChance: 0.05 }, "skill-tree/fortune-double-loot"),
  "fortune-purity": skill("fortune", "Geste parfait", "+25 % d’éclats lorsqu’une relique est brisée en un seul coup.", 120, ["fortune-geode"], { oneShotLoot: 0.25 }, "prestige-items/double-loot-ring"),
  "fortune-overflow": skill("fortune", "Trésor du refuge", "+20 % d’éclats ; chaque destruction ajoute +1 % de butin pour la manche, jusqu’à +25 %.", 240, ["fortune-lucky", "fortune-purity"], { loot: 0.2, lootGrowth: 0.01 }, "skill-tree/loot-per-destroy"),
  "echo-reach": skill("echo", "Cercle d’écoute", "+12 % de portée.", 30, [], { radius: 0.12 }, "skill-tree/smash-hit-radius"),
  "echo-company": skill("echo", "Appel des reliques", "Deux reliques supplémentaires sur l’établi, jusqu’à 16.", 60, ["echo-reach"], { capacity: 2 }, "skill-tree/piggy-spawn-amount"),
  "echo-wave": skill("echo", "Onde de choc", "10 % de chance par frappe d’émettre une onde : 45 % des dégâts de base dans un rayon de 2.", 60, ["echo-reach"], { shockwaveChance: 0.1, shockwaveDamage: 0.45 }, "skill-tree/smash-shockwave"),
  "echo-gathering": skill("echo", "Grand rassemblement", "Deux autres reliques sur l’établi et +5 % de portée.", 120, ["echo-company"], { capacity: 2, radius: 0.05 }, "skill-tree/piggy-spawn-amount-2"),
  "echo-chain": skill("echo", "Mémoire en chaîne", "Chaque destruction a 15 % de chance de toucher les voisines à moins de 2 : 60 % des dégâts de base.", 120, ["echo-wave"], { chainChance: 0.15, chainDamage: 0.6 }, "street-smarts/chain-reaction"),
  "echo-harmony": skill("echo", "Accord du refuge", "+15 points de chance d’onde et +0,5 à son rayon.", 240, ["echo-gathering", "echo-chain"], { shockwaveChance: 0.15, shockwaveRadius: 0.5 }, "skill-tree/smash-shockwave-radius"),
} as const;
export const FOUNDRY_SKILLS = { ...LEGACY_FOUNDRY_SKILLS, ...FOUNDRY_REFERENCE_SKILLS } satisfies Record<string, FoundrySkill>;
export type FoundrySkillId = keyof typeof FOUNDRY_SKILLS;
export const FOUNDRY_SKILL_IDS = Object.keys(FOUNDRY_SKILLS) as FoundrySkillId[];
export const LEGACY_FOUNDRY_SKILL_IDS = Object.keys(LEGACY_FOUNDRY_SKILLS) as FoundrySkillId[];
export function foundrySkills(cycle: { economy?: number }): readonly FoundrySkillId[] { return cycle.economy === 4 ? FOUNDRY_REFERENCE_SKILL_IDS : LEGACY_FOUNDRY_SKILL_IDS; }
export function foundrySkill(id: FoundrySkillId): FoundrySkill { return FOUNDRY_SKILLS[id]; }
export function foundrySkillReady(id: FoundrySkillId, owned: readonly FoundrySkillId[]): boolean {
  const skill = foundrySkill(id);
  return skill.requires.every((parent) => owned.includes(parent as FoundrySkillId)) && (!skill.requiresAny?.length || skill.requiresAny.some((parent) => owned.includes(parent as FoundrySkillId)));
}
export function foundryReferenceModifiers(skills: readonly FoundrySkillId[]): FoundryReferenceModifiers {
  const result = { ...FOUNDRY_REFERENCE_MODIFIERS };
  for (const id of skills) for (const [key, value] of Object.entries(foundrySkill(id).reference ?? {})) result[key as keyof FoundryReferenceModifiers] += value;
  return result;
}

type Rarity = "common" | "uncommon" | "rare";
interface Blessing { name: string; detail: string; symbol: string; branch: FoundryBranch; rarity: Rarity; maxStacks: number; kind: "passive" | "technique" | "pact"; effects: Partial<FoundryModifiers>; source: string }
const blessing = (name: string, detail: string, symbol: string, branch: FoundryBranch, rarity: Rarity, maxStacks: number, kind: Blessing['kind'], effects: Partial<FoundryModifiers>, source: string): Blessing => ({ name, detail, symbol, branch, rarity, maxStacks, kind, effects, source });
export const BLESSINGS = {
  power: blessing("Force de la montagne", "+20 % de dégâts.", "◆", "forge", "common", 3, "passive", { power: 0.2 }, "street-smarts/more-damage"),
  cadence: blessing("Danse des étincelles", "+15 % de vitesse de frappe.", "ϟ", "storm", "common", 3, "passive", { cadence: 0.15 }, "street-smarts/faster-swings"),
  focus: blessing("Souffle du vivant", "+20 % de concentration maximale.", "❋", "sap", "common", 3, "passive", { focus: 0.2 }, "street-smarts/more-stamina"),
  reach: blessing("Écho des profondeurs", "+20 % de portée.", "◎", "echo", "common", 3, "passive", { radius: 0.2 }, "street-smarts/wide-swing"),
  loot: blessing("Présent des anciens", "+15 % d’éclats.", "✦", "fortune", "common", 3, "passive", { loot: 0.15 }, "street-smarts/more-loot"),
  critical: blessing("Regard du cristal", "+8 points de chance critique.", "✧", "forge", "common", 3, "passive", { critical: 0.08 }, "street-smarts/crit-chance"),
  efficient: blessing("Souffle économe", "Chaque frappe consomme 15 % de stamina en moins.", "❋", "sap", "common", 2, "passive", { drain: -0.15 }, "street-smarts/stamina-efficiency"),
  recovery: blessing("Sève généreuse", "+15 points de chance de récupération ; chaque récupération rend 2 points supplémentaires.", "❋", "sap", "common", 2, "passive", { recoveryChance: 0.15, recoveryAmount: 2 }, "street-smarts/recovery-bonus"),
  deepFreeze: blessing("Gel des souvenirs", "Toutes les 3 s, 20 % de chance de geler les reliques 2,5 s. Elles subissent alors +10 % de dégâts.", "❄", "echo", "rare", 1, "technique", { freezeChance: 0.2, freezeDamage: 0.1 }, "street-smarts/deep-freeze"),
  berserk: blessing("Fureur sylvestre", "Chaque destruction a 3 % de chance de donner 3 s de fureur : +20 % de dégâts, +50 % de cadence, coût en stamina par frappe divisé par deux.", "ϟ", "storm", "rare", 1, "technique", { berserkChance: 0.03 }, "street-smarts/berserk"),
  lightning: blessing("Foudre du refuge", "12 % de chance par frappe d’envoyer la foudre sur 2 autres cibles : 40 % des dégâts de base.", "ϟ", "storm", "uncommon", 1, "technique", { lightningChance: 0.12, lightningDamage: 0.4 }, "skill-tree/frenzy-blitz"),
  wildfire: blessing("Braises voyageuses", "15 % de chance d’embraser la cible pendant 3 s : 15 % des dégâts de base toutes les 0,5 s.", "♨", "storm", "uncommon", 1, "technique", { burnChance: 0.15, burnDamage: 0.15 }, "skill-tree/ignite-chance-1"),
  shockwave: blessing("Onde ancestrale", "12 % de chance par frappe de toucher les reliques à moins de 2 : 45 % des dégâts de base.", "◎", "echo", "uncommon", 1, "technique", { shockwaveChance: 0.12, shockwaveDamage: 0.45 }, "street-smarts/earthquake"),
  execution: blessing("Écho final", "Un critique achève les reliques à 10 % de vie ou moins.", "◆", "forge", "rare", 1, "technique", { execute: 0.1 }, "street-smarts/finisher"),
  gilded: blessing("Critiques d’ambre", "+15 % d’éclats sur les destructions critiques.", "✦", "fortune", "uncommon", 2, "passive", { criticalLoot: 0.15 }, "street-smarts/critical-gold-coins"),
  jackpot: blessing("Chance des filons", "4 % de chance de doubler le butin d’une relique.", "✦", "fortune", "rare", 1, "technique", { jackpotChance: 0.04 }, "skill-tree/fortune-double-loot"),
  oneShot: blessing("Geste sans retour", "+35 % d’éclats sur les reliques brisées en un coup.", "✧", "fortune", "uncommon", 1, "passive", { oneShotLoot: 0.35 }, "prestige-items/double-loot-ring"),
  crescendo: blessing("Crescendo", "Chaque destruction ajoute +1 % de dégâts pendant la manche, jusqu’à +25 %.", "◆", "forge", "uncommon", 1, "passive", { damageGrowth: 0.01 }, "skill-tree/damage-per-destroy"),
  chain: blessing("Souvenirs liés", "Chaque destruction a 12 % de chance de toucher les voisines à moins de 2 : 60 % des dégâts de base.", "◎", "echo", "rare", 1, "technique", { chainChance: 0.12, chainDamage: 0.6 }, "street-smarts/chain-reaction"),
  greed: blessing("Pacte d’ambre", "+25 % d’éclats, mais -15 % de concentration maximale.", "✦", "fortune", "uncommon", 1, "pact", { loot: 0.25, focus: -0.15 }, "street-smarts/loot-for-stamina"),
  brute: blessing("Pacte du brasier", "+25 % de dégâts, mais -15 % de concentration et -10 points de chance critique.", "◆", "forge", "uncommon", 1, "pact", { power: 0.25, focus: -0.15, critical: -0.1 }, "street-smarts/brute-force"),
  haste: blessing("Pacte de l’éclair", "+25 % de cadence, mais -15 % de dégâts.", "ϟ", "storm", "uncommon", 1, "pact", { cadence: 0.25, power: -0.15 }, "street-smarts/speed-for-damage"),
  guardian: blessing("Pacte des racines", "+25 % de concentration, mais -10 % d’éclats.", "❋", "sap", "uncommon", 1, "pact", { focus: 0.25, loot: -0.1 }, "street-smarts/stamina-for-damage"),
} as const;
export type FoundryBlessing = keyof typeof BLESSINGS;
export const BLESSING_IDS = Object.keys(BLESSINGS) as FoundryBlessing[];
export const FOUNDRY_RARITY = { common: { name: "Commun", weight: 5 }, uncommon: { name: "Singulier", weight: 3 }, rare: { name: "Rare", weight: 1.5 } } as const;
export const FOUNDRY_CHARMS = {
  ember: { name: "Anneau de braise", detail: "+10 % de dégâts, à chaque chantier.", cost: 1, effects: { power: 0.1 }, source: "prestige-items/damage-ring" },
  moss: { name: "Bracelet de mousse", detail: "+10 % de concentration maximale.", cost: 2, effects: { focus: 0.1 }, source: "prestige-items/stamina-ring" },
  amber: { name: "Anneau d’ambre", detail: "+10 % d’éclats sur les reliques.", cost: 3, effects: { loot: 0.1 }, source: "prestige-items/loot-ring" },
  copper: { name: "Bague de cuivre", detail: "+8 % de vitesse de frappe.", cost: 3, effects: { cadence: 0.08 }, source: "prestige-items/speed-ring" },
  sap: { name: "Talisman de sève", detail: "La première destruction de chaque manche rend 10 points de concentration.", cost: 4, effects: { firstKillRecovery: 10 }, source: "prestige-items/recovery-ring" },
  echo: { name: "Anneau des échos", detail: "La première frappe de chaque manche émet une onde infligeant 100 % des dégâts de base.", cost: 5, effects: { firstWave: 1 }, source: "prestige-items/shockwave-ring" },
} as const;
export type FoundryCharmId = keyof typeof FOUNDRY_CHARMS;
export const FOUNDRY_CHARM_IDS = Object.keys(FOUNDRY_CHARMS) as FoundryCharmId[];

export function foundryModifiers(cycle: { skills?: readonly FoundrySkillId[]; blessings: readonly FoundryBlessing[] }, charms: readonly FoundryCharmId[] = []): FoundryModifiers {
  const modifiers: FoundryModifiers = { ...FOUNDRY_MODIFIERS };
  const add = (effects: Partial<FoundryModifiers>) => { for (const key of Object.keys(effects) as (keyof FoundryModifiers)[]) modifiers[key] += effects[key] ?? 0; };
  for (const id of cycle.skills ?? []) add(FOUNDRY_SKILLS[id].effects);
  for (const id of cycle.blessings) add(BLESSINGS[id].effects);
  for (const id of charms) add(FOUNDRY_CHARMS[id].effects);
  return modifiers;
}
