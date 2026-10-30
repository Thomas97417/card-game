import { stepFoundryComplete, completeStrikeCost } from './foundry-complete';
import { TOOLS, foundryTools, foundryToolDefinition, legacyFoundryTool, type FoundryTool } from "./foundry-tools";
export * from "./foundry-tools";
import { BLESSINGS, BLESSING_IDS, FOUNDRY_SKILLS, FOUNDRY_CHARMS, FOUNDRY_RARITY, foundryModifiers,
  foundrySkills, foundrySkill, foundrySkillReady, foundryReferenceModifiers, foundryCompleteModifiers, type FoundryCompleteModifiers, type FoundryReferenceModifiers,
  type FoundryBlessing, type FoundrySkillId, type FoundryCharmId, type FoundryModifiers } from "./foundry-catalog";
export * from "./foundry-catalog";

/** Deterministic foundry rules. World coordinates are shared with the 3D renderer. */
export const FOUNDRY = {
  version: 11, stepMs: 50, legacyMaxTicks: 1500, batchTicks: 40, maxBatchTicks: 100, maxDraftInputs: 2400,
  maxTargets: 16, fullMaxTargets: 32, fullRelicScale: 0.8, width: 11.2, depth: 6.8, concentration: 100, drainPerTick: 0.1, staminaPerStrike: 1,
  roundsPerOrder: 3, baseTargets: 12, freezeEveryTicks: 60, freezeTicks: 50, berserkTicks: 60, burnTicks: 60, burnEveryTicks: 10,
  collisionPasses: 24, collisionGap: 0.001, spawnAttempts: 48,
  recoveryRefundLimit: 0.5,
  upgradeCosts: [1000, 20000, 400000], skillCosts: [300, 4000, 80000, 2000000],
  referenceLootMultipliers: [10, 20, 40, 80, 160],
  lootMultipliers: [10, 80, 400, 2000, 14000], resistances: [1, 3, 10, 35, 90],
  orderCosts: [2000, 20000, 150000, 1000000, 5000000],
  previousUpgradeCosts: [50, 100, 200], previousOrderCosts: [100, 250, 500, 900, 1500],
  legacyOrderCosts: [100, 200, 350, 550, 850],
  orders: ["Rallumer la balise", "Renforcer les portes", "Accorder le sanctuaire", "Réparer les sentinelles", "Éveiller le cœur du refuge"],
} as const;
export const ASSISTANT_IDS = ["smith", "dryad", "feline"] as const;
export type FoundryAssistant = (typeof ASSISTANT_IDS)[number];
export const ASSISTANTS = {
  smith: { name: "Forgeron de la citadelle", short: "Le Forgeron", detail: "+15 % aux bonus de dégâts · prêté par le refuge", art: "gnome", family: "gnome" },
  dryad: { name: "Dryade des fougères", short: "La Dryade", detail: "+15 % de concentration", art: "mushroom", family: "mushroom" },
  feline: { name: "Féline des clairières", short: "La Féline", detail: "+15 % d’éclats", art: "lynx", family: "lynx" },
} as const;
export const UPGRADE_IDS = ["power", "focus", "fortune"] as const;
export type FoundryUpgrade = (typeof UPGRADE_IDS)[number];
export const UPGRADES = {
  power: { name: "Bras du forgeron", detail: "+25 % de dégâts par niveau" },
  focus: { name: "Souffle des sources", detail: "+15 % de concentration par niveau" },
  fortune: { name: "Œil de l’artisan", detail: "+5 % de critiques par niveau" },
} as const;
export const RELIC_KINDS = ["urn", "geode", "runner", "spring", "chaos"] as const;
export type RelicKind = (typeof RELIC_KINDS)[number];
// Sources remain readable only for the deterministic replay of saved V1–V6 rounds.
export const ACTIVE_RELIC_KINDS = ["urn", "geode", "runner", "chaos"] as const;
export const RELICS = {
  urn: { name: "Urne d’ambre", hp: 4, loot: [3, 6], weight: 48, color: 0xc68a49, speed: 0.012, radius: 0.55, mass: 1, detail: "Fragile et généreuse" },
  geode: { name: "Géode ancienne", hp: 14, loot: [14, 23], weight: 20, color: 0x75c9cf, speed: 0.008, radius: 0.68, mass: 2.8, detail: "Résistante, riche en éclats" },
  runner: { name: "Relique fuyante", hp: 3, loot: [5, 10], weight: 13, color: 0xe3b44e, speed: 0.033, radius: 0.58, mass: 0.8, detail: "Se déplace sur l’établi" },
  spring: { name: "Source vivante", hp: 5, loot: [1, 3], weight: 12, color: 0x6ab889, speed: 0.015, radius: 0.55, mass: 1.15, detail: "Rend 8 points de concentration" },
  chaos: { name: "Cœur du Chaos", hp: 6, loot: [6, 12], weight: 7, color: 0xbc7cd7, speed: 0.018, radius: 0.64, mass: 1.4, detail: "Explose sur les objets voisins" },
} as const;
export interface FoundryCycle {
  number: number; shards: number; orderIndex: number; roundsLeft: number;
  upgrades: Record<FoundryUpgrade, number>; blessings: FoundryBlessing[];
  choices: FoundryBlessing[]; skills?: FoundrySkillId[]; seed?: number; economy?: 2 | 3 | 4 | 5; freeplay?: boolean; freeplayRounds?: number; coinBank?: number; coinCount?: number; status: "active" | "failed" | "completed" | "abandoned";
  purchasedTools?: FoundryTool[]; selectedTool?: FoundryTool;
}
export interface FoundryStats { damage: number; interval: number; radius: number; critical: number; loot: number; concentration: number; stamina?: number }
export interface FoundryRelic { id: number; kind: RelicKind; x: number; z: number; hp: number; maxHp: number; vx: number; vz: number; phase: number; glowing?: boolean; bonusLoot?: number }
export interface FoundryInput { x: number; z: number; active: boolean }
export interface FoundryRound {
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11; rng: number; nextId: number; tick: number; concentration: number;
  stats: FoundryStats; tool: FoundryTool; assistant: FoundryAssistant; nextStrike: number;
  shards: number; broken: number; hits: number; criticals: number; ended: boolean;
  targets: FoundryRelic[];
  rogue?: { modifiers: FoundryModifiers; capacity: number; pressure: number; frenzyUntil: number; frozenUntil: number; nextFreeze: number; strikes: number; jackpots: number; wealth?: number; recoveryReserve?: number;
    complete?: { modifiers: FoundryCompleteModifiers; baseCadence: number; hits: number; misses: number; guardUsed: boolean; windUsed: boolean; lastStandUsed: boolean; windUntil: number; tantrumUntil: number; rageUntil: number; nextRay: number; nextSpawn: number; pendingSpawns: number; nextStorm: number; stormUntil: number; coinBank: number; coinCount: number; superJackpots: number; rocks: { at: number; x: number; z: number; announced: boolean }[] };
    reference?: { modifiers: FoundryReferenceModifiers; spent: number; combo: number; previousKind?: RelicKind; firstHitUsed: boolean };
    burns: { id: number; until: number; next: number }[] };

}
export interface FoundryImpact { x: number; z: number; targetId: number; kind: RelicKind; damage: number; critical: boolean; broken: boolean; loot: number }
export interface FoundryEffect { kind: "freeze" | "lightning" | "burn" | "frenzy" | "shockwave" | "jackpot" | "phantom" | "ray" | "rockfall" | "rock" | "coinrain" | "wind" | "lastStand" | "tantrum"; x: number; z: number; toX?: number; toZ?: number; radius?: number; duration?: number }
export interface FoundryFrame { strike: boolean; impacts: FoundryImpact[]; effects?: FoundryEffect[]; strikePosition?: { x: number; z: number } }
export interface FoundrySummary { shards: number; broken: number; hits: number; criticals: number; seconds: number }

export function foundryToolStrikeCost(tool: FoundryTool, drain = 0, furious = false, stamina = TOOLS[tool].stamina): number {
  return FOUNDRY.staminaPerStrike * stamina * Math.max(0.25, 1 + drain) * (furious ? 0.5 : 1);
}
export function foundryStrikeCost(round: FoundryRound): number {
  if (round.version >= 11) return completeStrikeCost(round);
  const rogue = round.rogue;
  const cost = foundryToolStrikeCost(round.tool, rogue?.modifiers.drain, !!rogue && rogue.frenzyUntil > round.tick, round.stats.stamina ?? legacyFoundryTool(round.tool).stamina);
  return round.version >= 10 ? Math.max(0.25, cost) : cost;
}

export function newFoundryCycle(number = 1, seed = Math.imul(number, 2654435761) >>> 0): FoundryCycle {
  return { number, shards: 0, orderIndex: 0, roundsLeft: FOUNDRY.roundsPerOrder, upgrades: { power: 0, focus: 0, fortune: 0 }, blessings: [], choices: [], skills: [], purchasedTools: [], selectedTool: "mallet", seed, economy: 5, status: "active" };
}
export function ownsFoundryTool(cycle: FoundryCycle, tool: FoundryTool): boolean {
  return tool === "mallet" || !!cycle.purchasedTools?.includes(tool);
}
export function equipFoundryTool(cycle: FoundryCycle, tool: FoundryTool): FoundryCycle {
  if (cycle.status !== "active" || cycle.choices.length || cycle.roundsLeft <= 0) throw new Error("Livre d’abord la commande ou choisis ta bénédiction.");
  if (!ownsFoundryTool(cycle, tool)) throw new Error("Cet outil doit être acheté pour ce chantier avant de l’équiper.");
  return { ...cycle, selectedTool: tool };
}
export function buyFoundryTool(cycle: FoundryCycle, tool: FoundryTool): FoundryCycle {
  if (cycle.status !== "active" || cycle.choices.length || cycle.roundsLeft <= 0) throw new Error("Livre d’abord la commande ou choisis ta bénédiction.");
  if (!foundryTools(cycle).includes(tool)) throw new Error("Ce marteau appartient au nouvel équilibrage. Ouvre le chantier suivant.");
  const cost = foundryToolDefinition(cycle, tool).cost;
  if (tool === "mallet" || !cost) throw new Error("Le maillet de cuivre est le seul outil gratuit.");
  if (cycle.purchasedTools?.includes(tool)) throw new Error("Cet outil est déjà acheté pour ce chantier.");
  if (cycle.shards < cost) throw new Error("Il manque des éclats pour ce marteau.");
  return { ...cycle, shards: cycle.shards - cost, purchasedTools: [...(cycle.purchasedTools ?? []), tool], selectedTool: tool };
}
function random(state: { rng: number }) {
  let x = state.rng | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rng = x >>> 0;
  return state.rng / 4294967296;
}
export function foundryStats(cycle: FoundryCycle, tool: FoundryTool, assistant: FoundryAssistant, charms: readonly FoundryCharmId[] = []): FoundryStats {
  const modifiers = foundryModifiers(cycle, charms); const base = foundryToolDefinition(cycle, tool); const modern = (cycle.economy ?? 0) >= 3;
  const reference = foundryReferenceModifiers((cycle.economy ?? 0) >= 4 ? cycle.skills ?? [] : [], cycle.economy);
  const powerBonus = cycle.upgrades.power * 0.25 + modifiers.power;
  return {
    // The loaned smith amplifies acquired bonuses, leaving a fresh mallet at 1 damage.
    damage: (base.damage + reference.flatDamage) * Math.max(0.25, 1 + powerBonus * (assistant === "smith" && powerBonus > 0 ? 1.15 : 1)),
    interval: Math.max(2, modern ? base.interval / Math.max(0.3, 1 + modifiers.cadence + base.cadence) : Math.round(base.interval / Math.max(0.3, 1 + modifiers.cadence))),
    radius: (base.radius + reference.flatRadius) * Math.max(0.4, 1 + modifiers.radius),
    critical: Math.max(0, Math.min(cycle.economy === 5 ? 1 : 0.65, 0.1 + cycle.upgrades.fortune * 0.05 + modifiers.critical + base.critical)),
    loot: Math.max(0.25, 1 + modifiers.loot) * (1 + base.loot) * (assistant === "feline" ? 1.15 : 1) * (1 + cycle.orderIndex * 0.08),
    concentration: Math.max(30, Math.round((100 + reference.flatStamina) * (1 + cycle.upgrades.focus * 0.15 + modifiers.focus) * (assistant === "dryad" ? 1.15 : 1))),
    ...(modern ? { stamina: Math.max(0.25, base.stamina + reference.flatDrain) } : {}),
  };
}
function spawn(state: FoundryRound): FoundryRelic {
  const scale = state.version >= 11 ? FOUNDRY.fullRelicScale : 1;
  const kinds = state.version >= 7 ? ACTIVE_RELIC_KINDS : RELIC_KINDS;
  let roll = random(state) * kinds.reduce((total, id) => total + RELICS[id].weight, 0);
  const kind = kinds.find((id) => (roll -= RELICS[id].weight) < 0) ?? "urn";
  let x = 0; let z = 0;
  if (state.version >= 3) {
    const radius = RELICS[kind].radius * scale;
    const limitX = FOUNDRY.width / 2 - radius;
    const limitZ = FOUNDRY.depth / 2 - radius;
    const clearance = (px: number, pz: number) => state.targets.reduce((gap, t) =>
      Math.min(gap, Math.hypot(t.x - px, t.z - pz) - radius - RELICS[t.kind].radius), Infinity);
    let best = -Infinity;
    for (let attempt = 0; attempt < FOUNDRY.spawnAttempts; attempt++) {
      const px = (random(state) * 2 - 1) * limitX;
      const pz = (random(state) * 2 - 1) * limitZ;
      const gap = clearance(px, pz);
      if (gap > best) { x = px; z = pz; best = gap; }
      if (gap >= FOUNDRY.collisionGap) break;
    }
    // A bounded deterministic search also covers crowded replacement spawns.
    if (best < FOUNDRY.collisionGap) {
      const columns = Math.ceil(limitX * 2 / 0.3), rows = Math.ceil(limitZ * 2 / 0.3);
      search: for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
        const px = -limitX + column / columns * limitX * 2;
        const pz = -limitZ + row / rows * limitZ * 2;
        const gap = clearance(px, pz);
        if (gap > best) { x = px; z = pz; best = gap; }
        if (gap >= FOUNDRY.collisionGap) break search;
      }
    }
  } else {
    // Preserve the random sequence and placement rules of saved V1/V2 rounds.
    for (let attempt = 0; attempt < 12; attempt++) {
      x = (random(state) - 0.5) * (FOUNDRY.width - 1.4);
      z = (random(state) - 0.5) * (FOUNDRY.depth - 1.3);
      if (state.targets.every((t) => Math.hypot(t.x - x, t.z - z) > 0.95)) break;
    }
  }
  const angle = random(state) * Math.PI * 2;
  // Persist velocities so pauses, retries and server replays use the same path.
  // Saved rounds finish with their original movement and collision rules.
  const speed = state.version >= 2 ? RELICS[kind].speed : kind === "runner" ? 0.033 : 0;
  const hp = state.version >= 4 ? Math.round(RELICS[kind].hp * (state.rogue?.pressure ?? 1)) : RELICS[kind].hp;
  const relic: FoundryRelic = { id: state.nextId++, kind, x, z, hp, maxHp: hp,
    vx: Math.cos(angle) * speed,
    vz: state.version === 1 ? kind === "runner" ? Math.sin(angle) * 0.027 : 0 : Math.sin(angle) * speed * (0.027 / 0.033),
    phase: random(state) * Math.PI * 2,
    ...(state.rogue?.reference?.modifiers.glowingChance && random(state) < state.rogue.reference.modifiers.glowingChance ? { glowing: true } : {}) };
  const full = state.rogue?.complete?.modifiers;
  if (full) {
    if (full.brightStart && relic.id === 1) relic.glowing = true;
    if (full.spawnLootChance > 0 && random(state) < full.spawnLootChance) relic.bonusLoot = full.spawnLootBonus;
  }
  return relic;
}
function confineRelic(t: FoundryRelic, scale = 1) {
  const radius = RELICS[t.kind].radius * scale;
  const limitX = FOUNDRY.width / 2 - radius, limitZ = FOUNDRY.depth / 2 - radius;
  if (t.x < -limitX) { t.x = -limitX; if (t.vx < 0) t.vx = -t.vx; }
  if (t.x > limitX) { t.x = limitX; if (t.vx > 0) t.vx = -t.vx; }
  if (t.z < -limitZ) { t.z = -limitZ; if (t.vz < 0) t.vz = -t.vz; }
  if (t.z > limitZ) { t.z = limitZ; if (t.vz > 0) t.vz = -t.vz; }
}
/** Elastic disc contacts, in stable target order, with no extra random draws. */
function resolveRelicContacts(targets: FoundryRelic[], bounce = true, scale = 1) {
  for (let pass = 0; pass < FOUNDRY.collisionPasses; pass++) {
    let corrected = false;
    for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i]!, b = targets[j]!;
      const dx = b.x - a.x, dz = b.z - a.z;
      const minimum = (RELICS[a.kind].radius + RELICS[b.kind].radius) * scale;
      const squared = dx * dx + dz * dz;
      if (squared > minimum * minimum) continue;
      const distance = Math.sqrt(squared);
      // Coincident centers must separate without NaN or consuming the loot RNG.
      const nx = distance > 1e-9 ? dx / distance : (a.id + b.id) % 2 ? 1 : 0;
      const nz = distance > 1e-9 ? dz / distance : (a.id + b.id) % 2 ? 0 : 1;
      const inverseA = 1 / RELICS[a.kind].mass, inverseB = 1 / RELICS[b.kind].mass;
      const sum = inverseA + inverseB;
      const separation = (minimum - distance + FOUNDRY.collisionGap) / sum;
      a.x -= nx * separation * inverseA; a.z -= nz * separation * inverseA;
      b.x += nx * separation * inverseB; b.z += nz * separation * inverseB;
      const closing = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (bounce && closing < 0) {
        const impulse = -2 * closing / sum;
        a.vx -= impulse * inverseA * nx; a.vz -= impulse * inverseA * nz;
        b.vx += impulse * inverseB * nx; b.vz += impulse * inverseB * nz;
      }
      corrected = true;
    }
    targets.forEach((t) => confineRelic(t, scale));
    if (!corrected) break;
  }
}
export function foundryLootMultiplier(cycle: FoundryCycle): number {
  const stage = Math.max(0, Math.min(FOUNDRY.orders.length - 1, cycle.orderIndex));
  return ((cycle.economy ?? 0) >= 4 ? FOUNDRY.referenceLootMultipliers : FOUNDRY.lootMultipliers)[stage]! * (cycle.freeplay ? Math.min(8, 1 + Math.floor((cycle.freeplayRounds ?? 0) / 3) * 0.5) : 1);
}
export function createFoundryRound(seed: number, cycle: FoundryCycle, tool: FoundryTool, assistant: FoundryAssistant, charms: readonly FoundryCharmId[] = []): FoundryRound {
  const stage = Math.max(0, Math.min(FOUNDRY.orders.length - 1, cycle.orderIndex));
  const stats = foundryStats(cycle, tool, assistant, charms);
  const modifiers = foundryModifiers(cycle, charms);
  modifiers.criticalDamage += foundryToolDefinition(cycle, tool).criticalDamage;
  const state: FoundryRound = { version: cycle.economy === 5 ? FOUNDRY.version : cycle.economy === 4 ? 10 : cycle.economy === 3 ? 9 : 8, rng: (seed >>> 0) || 1, nextId: 1, tick: 0, concentration: stats.concentration,
    stats, tool, assistant, nextStrike: 0, shards: 0, broken: 0, hits: 0, criticals: 0, ended: false, targets: [],
    rogue: { modifiers, capacity: Math.min(cycle.economy === 5 ? FOUNDRY.fullMaxTargets : FOUNDRY.maxTargets, FOUNDRY.baseTargets + modifiers.capacity), pressure: (cycle.economy ?? 0) >= 3 ? FOUNDRY.resistances[stage]! : 1 + cycle.orderIndex * 0.2,
      ...(cycle.economy && cycle.economy >= 3 ? { wealth: foundryLootMultiplier(cycle), recoveryReserve: 0 } : {}),
      ...((cycle.economy ?? 0) >= 4 ? { reference: { modifiers: foundryReferenceModifiers(cycle.skills ?? [], cycle.economy), spent: 0, combo: 0, firstHitUsed: false } } : {}),
      frenzyUntil: 0, frozenUntil: 0, nextFreeze: FOUNDRY.freezeEveryTicks, strikes: 0, jackpots: 0, burns: [] } };
  if (cycle.economy === 5) state.rogue!.complete = { modifiers: foundryCompleteModifiers(cycle.skills ?? []), baseCadence: 1 + modifiers.cadence + foundryToolDefinition(cycle, tool).cadence,
    hits: 0, misses: 0, guardUsed: false, windUsed: false, lastStandUsed: false, windUntil: 0, tantrumUntil: 0, rageUntil: 0, nextRay: 60, nextSpawn: 0, pendingSpawns: 0, nextStorm: 0, stormUntil: 0,
    coinBank: cycle.coinBank ?? 0, coinCount: cycle.coinCount ?? 0, superJackpots: 0, rocks: [] };
  for (let i = 0; i < state.rogue!.capacity; i++) state.targets.push(spawn(state));
  resolveRelicContacts(state.targets, false, state.version >= 11 ? FOUNDRY.fullRelicScale : 1);
  return state;
}
export function validFoundryInput(input: FoundryInput) {
  return Number.isFinite(input.x) && Number.isFinite(input.z) && typeof input.active === "boolean"
    && Math.abs(input.x) <= FOUNDRY.width / 2 && Math.abs(input.z) <= FOUNDRY.depth / 2;
}
/** Mutates one private simulation state, exactly once per 50 ms of active play. */
export function stepFoundry(state: FoundryRound, input: FoundryInput): FoundryFrame {
  const frame: FoundryFrame = { strike: false, impacts: [] };
  if (state.ended) return frame;
  if (!validFoundryInput(input)) throw new Error("Visée invalide.");
  if (state.version >= 11) return stepFoundryComplete(state, input);
  if (state.version >= 4) return stepFoundryRogue(state, input);
  state.tick++;
  state.concentration = Math.max(0, state.concentration - FOUNDRY.drainPerTick);
  if (state.version >= 3) {
    for (const t of state.targets) { t.x += t.vx; t.z += t.vz; confineRelic(t); }
    resolveRelicContacts(state.targets);
  } else {
    for (const t of state.targets) {
      if (Math.abs(t.x + t.vx) > FOUNDRY.width / 2 - 0.55) t.vx *= -1;
      if (Math.abs(t.z + t.vz) > FOUNDRY.depth / 2 - 0.55) t.vz *= -1;
      t.x += t.vx; t.z += t.vz;
    }
  }
  if (input.active && state.tick >= state.nextStrike && state.targets.some((t) => Math.hypot(t.x - input.x, t.z - input.z) <= state.stats.radius)) {
    frame.strike = true;
    state.nextStrike = state.tick + state.stats.interval;
    const critical = random(state) < state.stats.critical;
    const queue = state.targets.filter((t) => Math.hypot(t.x - input.x, t.z - input.z) <= state.stats.radius)
      .map((t) => ({ target: t, damage: state.stats.damage * (critical ? 2 : 1), critical }));
    const destroyed = new Set<number>();
    for (let index = 0; index < queue.length; index++) {
      const item = queue[index]!; const t = item.target;
      if (destroyed.has(t.id)) continue;
      t.hp = Math.max(0, t.hp - item.damage);
      const broken = t.hp === 0;
      let loot = 0;
      state.hits++; if (item.critical) state.criticals++;
      if (broken) {
        destroyed.add(t.id); state.broken++;
        const [low, high] = RELICS[t.kind].loot;
        loot = Math.round((low + Math.floor(random(state) * (high - low + 1))) * state.stats.loot);
        state.shards += loot;
        if (t.kind === "spring") state.concentration = Math.min(state.stats.concentration, state.concentration + 8);
        if (t.kind === "chaos") for (const neighbour of state.targets)
          if (neighbour.id !== t.id && !destroyed.has(neighbour.id) && Math.hypot(neighbour.x - t.x, neighbour.z - t.z) <= 2)
            queue.push({ target: neighbour, damage: 5, critical: false });
      }
      frame.impacts.push({ x: t.x, z: t.z, targetId: t.id, kind: t.kind, damage: item.damage, critical: item.critical, broken, loot });
    }
    state.targets = state.targets.filter((t) => !destroyed.has(t.id));
    while (state.targets.length < FOUNDRY.maxTargets) state.targets.push(spawn(state));
    if (state.version >= 3) resolveRelicContacts(state.targets, false);
  }
  state.ended = state.concentration < 0.00001 || state.tick >= FOUNDRY.legacyMaxTicks;
  return frame;
}
/** The build is frozen into the round; saved V4/V5 rounds retain their original stamina rules. */
function stepFoundryRogue(state: FoundryRound, input: FoundryInput): FoundryFrame {
  const frame: FoundryFrame = { strike: false, impacts: [], effects: [] };
  const rogue = state.rogue!; const mods = rogue.modifiers;
  const reference = rogue.reference, extra = reference?.modifiers;
  state.tick++;
  const fury = rogue.frenzyUntil > state.tick;
  if (state.version < 6) state.concentration = Math.max(0, state.concentration - FOUNDRY.drainPerTick * Math.max(0.25, 1 + mods.drain) * (fury ? 0.5 : 1));
  const roll = (chance: number) => chance > 0 && random(state) < Math.min(1, chance);
  if (mods.freezeChance > 0 && state.tick >= rogue.nextFreeze) {
    rogue.nextFreeze = state.tick + FOUNDRY.freezeEveryTicks;
    if (roll(mods.freezeChance)) {
      rogue.frozenUntil = state.tick + FOUNDRY.freezeTicks;
      frame.effects!.push({ kind: "freeze", x: 0, z: 0, radius: 7 });
    }
  }
  const frozen = rogue.frozenUntil > state.tick;
  if (!frozen) {
    for (const target of state.targets) { target.x += target.vx; target.z += target.vz; confineRelic(target); }
    resolveRelicContacts(state.targets);
  }
  const base = state.stats.damage * (fury ? 1.2 : 1) * (1 + Math.min(0.25, state.broken * mods.damageGrowth))
    * (1 + (reference ? reference.spent * extra!.staminaDamage + reference.combo * extra!.comboDamage + state.targets.length * extra!.crowdDamage : 0));
  type Hit = { target: FoundryRelic; damage: number; critical: boolean; direct?: boolean };
  const queue: Hit[] = [];
  for (const burn of rogue.burns) if (burn.until >= state.tick && burn.next <= state.tick) {
    burn.next = state.tick + FOUNDRY.burnEveryTicks;
    const target = state.targets.find((relic) => relic.id === burn.id);
    if (target) queue.push({ target, damage: base * mods.burnDamage, critical: false });
  }
  const direct = state.targets.filter((target) => Math.hypot(target.x - input.x, target.z - input.z) <= state.stats.radius);
  if (state.tick >= state.nextStrike && (state.version >= 5 || (input.active && direct.length))) {
    frame.strike = true; rogue.strikes++;
    if (state.version >= 6) {
      const cost = foundryStrikeCost(state);
      if (reference) reference.spent += Math.min(state.concentration, cost);
      if (state.version >= 9) rogue.recoveryReserve = (rogue.recoveryReserve ?? 0) + Math.min(state.concentration, cost) * FOUNDRY.recoveryRefundLimit;
      state.concentration = Math.max(0, state.concentration - cost);
    }
    if (state.version >= 5) frame.strikePosition = { x: input.x, z: input.z };
    const interval = Math.max(2, state.stats.interval / ((fury ? 1.5 + (extra?.rageSpeed ?? 0) : 1) + (reference ? reference.spent * extra!.staminaSpeed : 0)));
    state.nextStrike = state.version >= 9 ? (rogue.strikes === 1 ? state.tick : state.nextStrike) + interval : state.tick + Math.round(interval);
    const critical = direct.length > 0 && !reference && roll(state.stats.critical);
    const doubleHit = !!reference && direct.length > 0 && roll(extra!.doubleHitChance);
    const firstHit = !!reference && direct.length > 0 && !reference.firstHitUsed;
    if (reference) { reference.combo = direct.length ? reference.combo + 1 : 0; if (firstHit) reference.firstHitUsed = true; }
    for (const target of direct) {
      const low = target.hp / target.maxHp < 0.25;
      const crit = reference ? roll(state.stats.critical + (low ? extra!.lowHpCritical : 0)) : critical;
      const damage = reference ? base * ((crit ? Math.max(1.2, 2 + mods.criticalDamage) : 1)
        + (target.hp === target.maxHp ? mods.firstHitBonus : 0) + (low ? extra!.lowHpDamage : 0)
        + (direct.length > 1 ? extra!.multiHitDamage : 0) + (reference.previousKind && reference.previousKind !== target.kind ? extra!.switchDamage : 0)) * (firstHit ? 1 + extra!.firstStrikeDamage : 1)
        : base * (crit ? Math.max(1.2, 2 + mods.criticalDamage) : 1) * (target.hp === target.maxHp ? 1 + mods.firstHitBonus : 1);
      queue.push({ target, damage, critical: crit, direct: true });
      if (doubleHit) queue.push({ target, damage, critical: crit, direct: true });
      if (roll(mods.burnChance)) {
        const until = state.tick + FOUNDRY.burnTicks + (extra?.burnDuration ?? 0) * 20;
        const previous = rogue.burns.find((burn) => burn.id === target.id);
        if (previous) previous.until = until;
        else rogue.burns.push({ id: target.id, until, next: state.tick + FOUNDRY.burnEveryTicks });
        frame.effects!.push({ kind: "burn", x: target.x, z: target.z });
      }
    }
    if (reference && direct.length) reference.previousKind = direct[0]!.kind;
    if (roll(mods.lightningChance)) {
      const targets = state.targets.filter((target) => !direct.includes(target) && Math.hypot(target.x - input.x, target.z - input.z) <= 4)
        .sort((a, b) => Math.hypot(a.x - input.x, a.z - input.z) - Math.hypot(b.x - input.x, b.z - input.z) || a.id - b.id)
        .slice(0, 2 + mods.lightningTargets);
      for (let ray = 0; ray < 1 + (extra?.lightningRays ?? 0); ray++) for (const target of targets) {
        queue.push({ target, damage: base * mods.lightningDamage, critical: false });
        frame.effects!.push({ kind: "lightning", x: input.x, z: input.z, toX: target.x, toZ: target.z });
      }
    }
    const firstWave = mods.firstWave > 0 && rogue.strikes === 1;
    if (firstWave || roll(mods.shockwaveChance)) {
      const radius = extra?.globalWave ? 14 : 2 + mods.shockwaveRadius;
      for (const target of state.targets) if (Math.hypot(target.x - input.x, target.z - input.z) <= radius)
        queue.push({ target, damage: base * (firstWave ? 1 : mods.shockwaveDamage), critical: false });
      frame.effects!.push({ kind: "shockwave", x: input.x, z: input.z, radius });
    }
  }
  const destroyed = new Set<number>();
  const restore = (amount: number) => { state.concentration = Math.min(state.stats.concentration, state.concentration + amount); };
  for (let index = 0; index < queue.length; index++) {
    const hit = queue[index]!; const target = hit.target;
    if (destroyed.has(target.id) || hit.damage <= 0) continue;
    const intact = target.hp === target.maxHp;
    const damage = hit.damage * (frozen ? 1 + mods.freezeDamage : 1);
    target.hp = Math.max(0, target.hp - damage);
    if (hit.critical && mods.execute > 0 && target.hp / target.maxHp <= mods.execute) target.hp = 0;
    const broken = target.hp === 0; let loot = 0;
    state.hits++; if (hit.critical) state.criticals++;
    if (broken) {
      destroyed.add(target.id); state.broken++;
      const [low, high] = RELICS[target.kind].loot;
      const bonus = 1 + (hit.critical ? mods.criticalLoot : 0) + (target.kind === "geode" ? mods.geodeLoot : 0) + (extra?.lootPerType ?? 0) * ACTIVE_RELIC_KINDS.length
        + (intact && hit.direct ? mods.oneShotLoot : 0) + Math.min(0.25, (state.broken - 1) * mods.lootGrowth);
      const jackpot = roll(mods.jackpotChance);
      let amount = low + Math.floor(random(state) * (high - low + 1));
      if (extra && roll(extra.luck)) amount = Math.max(amount, low + Math.floor(random(state) * (high - low + 1)));
      if (target.glowing) amount = high;
      const luminous = target.glowing && extra && roll(extra.glowingBonusChance) ? 1 + extra.glowingBonus : 1;
      loot = Math.max(1, Math.round(amount * state.stats.loot * (rogue.wealth ?? 1) * bonus * (jackpot ? 2 : 1) * luminous));
      state.shards += loot;
      if (jackpot) { rogue.jackpots++; frame.effects!.push({ kind: "jackpot", x: target.x, z: target.z }); }
      if (state.version < 7 && target.kind === "spring") restore(8 + mods.springRecovery);
      if (state.broken === 1) restore(mods.firstKillRecovery);
      if (roll(mods.recoveryChance)) {
        const requested = reference ? Math.max(2, mods.recoveryAmount) : 2 + mods.recoveryAmount;
        const amount = state.version >= 9 ? Math.min(requested, rogue.recoveryReserve ?? 0, state.stats.concentration - state.concentration) : requested;
        restore(amount);
        if (state.version >= 9) rogue.recoveryReserve = (rogue.recoveryReserve ?? 0) - amount;
      }
      if (extra && rogue.burns.some((burn) => burn.id === target.id) && roll(extra.fireSpreadChance)) {
        for (const neighbour of state.targets) if (!destroyed.has(neighbour.id) && Math.hypot(neighbour.x - target.x, neighbour.z - target.z) <= extra.fireSpreadRange) {
          const until = state.tick + FOUNDRY.burnTicks + extra.burnDuration * 20;
          const previous = rogue.burns.find((burn) => burn.id === neighbour.id);
          if (previous) previous.until = Math.max(previous.until, until);
          else rogue.burns.push({ id: neighbour.id, until, next: state.tick + FOUNDRY.burnEveryTicks });
          frame.effects!.push({ kind: "burn", x: neighbour.x, z: neighbour.z });
        }
      }
      if (roll(mods.berserkChance)) {
        rogue.frenzyUntil = Math.max(rogue.frenzyUntil, state.tick + FOUNDRY.berserkTicks + mods.berserkDuration);
        frame.effects!.push({ kind: "frenzy", x: target.x, z: target.z });
      }
      if (target.kind === "chaos" || roll(mods.chainChance)) {
        const chaos = target.kind === "chaos";
        for (const neighbour of state.targets) if (neighbour.id !== target.id && !destroyed.has(neighbour.id) && Math.hypot(neighbour.x - target.x, neighbour.z - target.z) <= 2)
          queue.push({ target: neighbour, damage: chaos ? 5 * (state.version >= 9 ? rogue.pressure : 1) : base * mods.chainDamage, critical: false });
        frame.effects!.push({ kind: "shockwave", x: target.x, z: target.z, radius: 2 });
      }
    }
    frame.impacts.push({ x: target.x, z: target.z, targetId: target.id, kind: target.kind, damage, critical: hit.critical, broken, loot });
  }
  if (destroyed.size) {
    state.targets = state.targets.filter((target) => !destroyed.has(target.id));
    while (state.targets.length < rogue.capacity) state.targets.push(spawn(state));
    resolveRelicContacts(state.targets, false);
  }
  rogue.burns = rogue.burns.filter((burn) => burn.until >= state.tick && !destroyed.has(burn.id));
  if (state.version >= 5 && state.concentration < 0.00001) state.concentration = 0;
  state.ended = state.concentration < 0.00001 || (state.version === 4 && state.tick >= FOUNDRY.legacyMaxTicks);
  return frame;
}

export function foundrySummary(round: FoundryRound): FoundrySummary {
  return { shards: round.shards, broken: round.broken, hits: round.hits, criticals: round.criticals, seconds: round.tick * FOUNDRY.stepMs / 1000 };
}
export function foundryOrderCost(cycle: FoundryCycle) {
  return ((cycle.economy ?? 0) >= 3 ? FOUNDRY.orderCosts : cycle.economy === 2 ? FOUNDRY.previousOrderCosts : FOUNDRY.legacyOrderCosts)[cycle.orderIndex];
}
export function settleFoundryRound(cycle: FoundryCycle, round: FoundryRound): FoundryCycle {
  if (!round.ended || cycle.status !== "active" || cycle.choices.length || cycle.roundsLeft <= 0) throw new Error("Cette manche ne peut pas être terminée.");
  const next = { ...cycle, shards: cycle.shards + round.shards, roundsLeft: cycle.freeplay ? FOUNDRY.roundsPerOrder : cycle.roundsLeft - 1,
    ...(cycle.economy === 5 ? { coinBank: round.rogue?.complete?.coinBank ?? 0, coinCount: round.rogue?.complete?.coinCount ?? 0 } : {}),
    ...(cycle.freeplay ? { freeplayRounds: (cycle.freeplayRounds ?? 0) + 1 } : {}) };
  if (!next.roundsLeft && next.shards < foundryOrderCost(next)!) next.status = "failed";
  return next;
}
export function buyFoundryUpgrade(cycle: FoundryCycle, upgrade: FoundryUpgrade): FoundryCycle {
  if (cycle.status !== "active" || cycle.choices.length || !cycle.roundsLeft) throw new Error("Livre d’abord la commande en cours.");
  const level = cycle.upgrades[upgrade]; const cost = ((cycle.economy ?? 0) >= 3 ? FOUNDRY.upgradeCosts : FOUNDRY.previousUpgradeCosts)[level];
  if (cost === undefined) throw new Error("Cette amélioration est au maximum.");
  if (cycle.shards < cost) throw new Error("Il manque des éclats.");
  return { ...cycle, shards: cycle.shards - cost, upgrades: { ...cycle.upgrades, [upgrade]: level + 1 } };
}
export function deliverFoundryOrder(cycle: FoundryCycle): FoundryCycle {
  if (cycle.status !== "active" || cycle.choices.length) throw new Error("Choisis d’abord ta bénédiction.");
  if (cycle.freeplay) throw new Error("Toutes les commandes sont déjà honorées.");
  const cost = foundryOrderCost(cycle);
  if (cost === undefined || cycle.shards < cost) throw new Error("Il manque des éclats pour cette commande.");
  const rng = { rng: ((cycle.seed ?? Math.imul(cycle.number, 2654435761)) ^ Math.imul(cycle.orderIndex + 1, 1597334677)) >>> 0 || 1 };
  const pool = BLESSING_IDS.filter((id) => cycle.blessings.filter((owned) => owned === id).length < BLESSINGS[id].maxStacks);
  const choices: FoundryBlessing[] = [];
  const draw = (technique = false): void => {
    let eligible = pool.filter((id) => !technique || BLESSINGS[id].kind === "technique");
    if (!eligible.length) eligible = pool;
    const weight = (id: FoundryBlessing) => FOUNDRY_RARITY[BLESSINGS[id].rarity].weight * (1 + Math.min(2, (cycle.skills ?? []).filter((skill) => FOUNDRY_SKILLS[skill].branch === BLESSINGS[id].branch).length * 0.35));
    let roll = random(rng) * eligible.reduce((sum, id) => sum + weight(id), 0);
    const id = eligible.find((candidate) => (roll -= weight(candidate)) <= 0) ?? eligible[eligible.length - 1]!;
    pool.splice(pool.indexOf(id), 1); choices.push(id);
  };
  draw(true); draw(); draw();
  const orderIndex = cycle.orderIndex + 1;
  return { ...cycle, shards: cycle.shards - cost, orderIndex, roundsLeft: FOUNDRY.roundsPerOrder, choices,
    status: orderIndex === FOUNDRY.orderCosts.length ? "completed" : "active" };
}
export function chooseFoundryBlessing(cycle: FoundryCycle, blessing: FoundryBlessing): FoundryCycle {
  if (!cycle.choices.includes(blessing)) throw new Error("Cette bénédiction n’est pas proposée.");
  if (cycle.blessings.filter((id) => id === blessing).length >= BLESSINGS[blessing].maxStacks) throw new Error("Cette bénédiction est déjà au maximum.");
  return { ...cycle, blessings: [...cycle.blessings, blessing], choices: [] };
}
export function foundrySkillCost(cycle: FoundryCycle, id: FoundrySkillId): number {
  const cost = foundrySkill(id, cycle).cost;
  if ((cycle.economy ?? 0) >= 4) return cost;
  return cycle.economy === 3 ? FOUNDRY.skillCosts[([30, 60, 120, 240] as number[]).indexOf(cost)]! : cost;
}
export function buyFoundrySkill(cycle: FoundryCycle, id: FoundrySkillId): FoundryCycle {
  if (cycle.status !== "active" || cycle.choices.length || !cycle.roundsLeft) throw new Error("Livre d’abord la commande ou choisis ta bénédiction.");
  const skill = FOUNDRY_SKILLS[id]; const owned = cycle.skills ?? [];
  if (!skill || !foundrySkills(cycle).includes(id)) throw new Error("Ce savoir est inconnu pour ce chantier.");
  if (owned.includes(id)) throw new Error("Ce savoir est déjà acquis.");
  if (!foundrySkillReady(id, owned)) throw new Error("Apprends d’abord les savoirs reliés à ce nœud.");
  const cost = foundrySkillCost(cycle, id);
  if (cycle.shards < cost) throw new Error("Il manque des éclats.");
  return { ...cycle, shards: cycle.shards - cost, skills: [...owned, id] };
}
export function buyFoundryCharm(mastery: number, spent: number, charms: readonly FoundryCharmId[], id: FoundryCharmId) {
  const charm = FOUNDRY_CHARMS[id];
  if (!charm) throw new Error("Ce talisman est inconnu.");
  if (charms.includes(id)) throw new Error("Ce talisman est déjà acquis.");
  if (mastery - spent < charm.cost) throw new Error("Il manque des points de maîtrise.");
  return { masterySpent: spent + charm.cost, charms: [...charms, id] };
}

/** Compact deterministic digest distinguishes a retry from a competing tab. */
export function foundryInputDigest(inputs: readonly FoundryInput[]) {
  let hash = 2166136261;
  for (const char of JSON.stringify(inputs)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function continueFoundryCycle(cycle: FoundryCycle): FoundryCycle {
  if (cycle.economy !== 5 || cycle.status !== "completed" || cycle.choices.length) throw new Error("Termine les cinq commandes et choisis ta bénédiction pour poursuivre.");
  return { ...cycle, status: "active", freeplay: true, freeplayRounds: 0, roundsLeft: FOUNDRY.roundsPerOrder };
}
export { random as foundryRandom, spawn as spawnFoundryRelic, confineRelic as confineFoundryRelic, resolveRelicContacts as resolveFoundryContacts };
