/** Deterministic foundry rules. World coordinates are shared with the 3D renderer. */
export const FOUNDRY = {
  version: 1, stepMs: 50, maxTicks: 1500, batchTicks: 40, maxBatchTicks: 100,
  maxTargets: 16, width: 11.2, depth: 6.8, concentration: 100, drainPerTick: 0.1,
  upgradeCosts: [50, 100, 200], orderCosts: [100, 200, 350, 550, 850],
  orders: ["Rallumer la balise", "Renforcer les portes", "Accorder le sanctuaire", "Réparer les sentinelles", "Éveiller le cœur du refuge"],
} as const;
export const TOOL_IDS = ["mallet", "swift", "resonance"] as const;
export type FoundryTool = (typeof TOOL_IDS)[number];
export const TOOLS = {
  mallet: { name: "Maillet de cuivre", detail: "Une frappe solide et équilibrée", damage: 3, interval: 11, radius: 0.72, mastery: 0 },
  swift: { name: "Martelet vif", detail: "Léger, précis et très rapide", damage: 1.8, interval: 5, radius: 0.55, mastery: 1 },
  resonance: { name: "Marteau de résonance", detail: "Une onde qui touche les objets voisins", damage: 2.4, interval: 16, radius: 1.65, mastery: 3 },
} as const;
export const ASSISTANT_IDS = ["smith", "dryad", "feline"] as const;
export type FoundryAssistant = (typeof ASSISTANT_IDS)[number];
export const ASSISTANTS = {
  smith: { name: "Forgeron de la citadelle", short: "Le Forgeron", detail: "+15 % de dégâts · prêté par le refuge", art: "gnome", family: "gnome" },
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
export const BLESSING_IDS = ["power", "cadence", "focus", "reach", "loot", "critical"] as const;
export type FoundryBlessing = (typeof BLESSING_IDS)[number];
export const BLESSINGS: Record<FoundryBlessing, { name: string; detail: string; symbol: string }> = {
  power: { name: "Force de la montagne", detail: "+20 % de dégâts", symbol: "◆" },
  cadence: { name: "Danse des étincelles", detail: "+15 % de vitesse de frappe", symbol: "ϟ" },
  focus: { name: "Souffle du vivant", detail: "+20 % de concentration", symbol: "❋" },
  reach: { name: "Écho des profondeurs", detail: "+20 % de portée", symbol: "◎" },
  loot: { name: "Présent des anciens", detail: "+15 % d’éclats", symbol: "✦" },
  critical: { name: "Regard du cristal", detail: "+8 % de critiques", symbol: "✧" },
};
export const RELIC_KINDS = ["urn", "geode", "runner", "spring", "chaos"] as const;
export type RelicKind = (typeof RELIC_KINDS)[number];
export const RELICS = {
  urn: { name: "Urne d’ambre", hp: 4, loot: [3, 6], weight: 48, color: 0xc68a49, detail: "Fragile et généreuse" },
  geode: { name: "Géode ancienne", hp: 14, loot: [14, 23], weight: 20, color: 0x75c9cf, detail: "Résistante, riche en éclats" },
  runner: { name: "Relique fuyante", hp: 3, loot: [5, 10], weight: 13, color: 0xe3b44e, detail: "Se déplace sur l’établi" },
  spring: { name: "Source vivante", hp: 5, loot: [1, 3], weight: 12, color: 0x6ab889, detail: "Rend 8 points de concentration" },
  chaos: { name: "Cœur du Chaos", hp: 6, loot: [6, 12], weight: 7, color: 0xbc7cd7, detail: "Explose sur les objets voisins" },
} as const;
export interface FoundryCycle {
  number: number; shards: number; orderIndex: number; roundsLeft: number;
  upgrades: Record<FoundryUpgrade, number>; blessings: FoundryBlessing[];
  choices: FoundryBlessing[]; status: "active" | "failed" | "completed";
}
export interface FoundryStats { damage: number; interval: number; radius: number; critical: number; loot: number; concentration: number }
export interface FoundryRelic { id: number; kind: RelicKind; x: number; z: number; hp: number; maxHp: number; vx: number; vz: number; phase: number }
export interface FoundryInput { x: number; z: number; active: boolean }
export interface FoundryRound {
  version: 1; rng: number; nextId: number; tick: number; concentration: number;
  stats: FoundryStats; tool: FoundryTool; assistant: FoundryAssistant; nextStrike: number;
  shards: number; broken: number; hits: number; criticals: number; ended: boolean;
  targets: FoundryRelic[];
}
export interface FoundryImpact { x: number; z: number; targetId: number; kind: RelicKind; damage: number; critical: boolean; broken: boolean; loot: number }
export interface FoundryFrame { strike: boolean; impacts: FoundryImpact[] }
export interface FoundrySummary { shards: number; broken: number; hits: number; criticals: number; seconds: number }

export function newFoundryCycle(number = 1): FoundryCycle {
  return { number, shards: 0, orderIndex: 0, roundsLeft: 2, upgrades: { power: 0, focus: 0, fortune: 0 }, blessings: [], choices: [], status: "active" };
}
function random(state: { rng: number }) {
  let x = state.rng | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rng = x >>> 0;
  return state.rng / 4294967296;
}
export function foundryStats(cycle: FoundryCycle, tool: FoundryTool, assistant: FoundryAssistant): FoundryStats {
  const count = (kind: FoundryBlessing) => cycle.blessings.filter((b) => b === kind).length;
  const base = TOOLS[tool];
  return {
    damage: base.damage * (1 + cycle.upgrades.power * 0.25 + count("power") * 0.2) * (assistant === "smith" ? 1.15 : 1),
    interval: Math.max(2, Math.round(base.interval / (1 + count("cadence") * 0.15))),
    radius: base.radius * (1 + count("reach") * 0.2),
    critical: Math.min(0.65, 0.1 + cycle.upgrades.fortune * 0.05 + count("critical") * 0.08),
    loot: (1 + count("loot") * 0.15) * (assistant === "feline" ? 1.15 : 1),
    concentration: Math.round(100 * (1 + cycle.upgrades.focus * 0.15 + count("focus") * 0.2) * (assistant === "dryad" ? 1.15 : 1)),
  };
}
function spawn(state: FoundryRound): FoundryRelic {
  let roll = random(state) * 100;
  const kind = RELIC_KINDS.find((id) => (roll -= RELICS[id].weight) < 0) ?? "urn";
  let x = 0; let z = 0;
  // Best-effort spacing keeps silhouettes readable, without physics affecting rules.
  for (let attempt = 0; attempt < 12; attempt++) {
    x = (random(state) - 0.5) * (FOUNDRY.width - 1.4);
    z = (random(state) - 0.5) * (FOUNDRY.depth - 1.3);
    if (state.targets.every((t) => Math.hypot(t.x - x, t.z - z) > 0.95)) break;
  }
  const angle = random(state) * Math.PI * 2;
  return { id: state.nextId++, kind, x, z, hp: RELICS[kind].hp, maxHp: RELICS[kind].hp,
    vx: kind === "runner" ? Math.cos(angle) * 0.033 : 0,
    vz: kind === "runner" ? Math.sin(angle) * 0.027 : 0, phase: random(state) * Math.PI * 2 };
}
export function createFoundryRound(seed: number, cycle: FoundryCycle, tool: FoundryTool, assistant: FoundryAssistant): FoundryRound {
  const stats = foundryStats(cycle, tool, assistant);
  const state: FoundryRound = { version: 1, rng: (seed >>> 0) || 1, nextId: 1, tick: 0, concentration: stats.concentration,
    stats, tool, assistant, nextStrike: 0, shards: 0, broken: 0, hits: 0, criticals: 0, ended: false, targets: [] };
  for (let i = 0; i < FOUNDRY.maxTargets; i++) state.targets.push(spawn(state));
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
  state.tick++;
  state.concentration = Math.max(0, state.concentration - FOUNDRY.drainPerTick);
  for (const t of state.targets) {
    if (Math.abs(t.x + t.vx) > FOUNDRY.width / 2 - 0.55) t.vx *= -1;
    if (Math.abs(t.z + t.vz) > FOUNDRY.depth / 2 - 0.55) t.vz *= -1;
    t.x += t.vx; t.z += t.vz;
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
  }
  state.ended = state.concentration < 0.00001 || state.tick >= FOUNDRY.maxTicks;
  return frame;
}
export function foundrySummary(round: FoundryRound): FoundrySummary {
  return { shards: round.shards, broken: round.broken, hits: round.hits, criticals: round.criticals, seconds: round.tick * FOUNDRY.stepMs / 1000 };
}
export function settleFoundryRound(cycle: FoundryCycle, round: FoundryRound): FoundryCycle {
  if (!round.ended || cycle.status !== "active" || cycle.choices.length || cycle.roundsLeft <= 0) throw new Error("Cette manche ne peut pas être terminée.");
  const next = { ...cycle, shards: cycle.shards + round.shards, roundsLeft: cycle.roundsLeft - 1 };
  if (!next.roundsLeft && next.shards < FOUNDRY.orderCosts[next.orderIndex]!) next.status = "failed";
  return next;
}
export function buyFoundryUpgrade(cycle: FoundryCycle, upgrade: FoundryUpgrade): FoundryCycle {
  if (cycle.status !== "active" || cycle.choices.length || !cycle.roundsLeft) throw new Error("Livre d’abord la commande en cours.");
  const level = cycle.upgrades[upgrade]; const cost = FOUNDRY.upgradeCosts[level];
  if (cost === undefined) throw new Error("Cette amélioration est au maximum.");
  if (cycle.shards < cost) throw new Error("Il manque des éclats.");
  return { ...cycle, shards: cycle.shards - cost, upgrades: { ...cycle.upgrades, [upgrade]: level + 1 } };
}
export function deliverFoundryOrder(cycle: FoundryCycle): FoundryCycle {
  if (cycle.status !== "active" || cycle.choices.length) throw new Error("Choisis d’abord ta bénédiction.");
  const cost = FOUNDRY.orderCosts[cycle.orderIndex];
  if (cost === undefined || cycle.shards < cost) throw new Error("Il manque des éclats pour cette commande.");
  const rng = { rng: ((cycle.number * 2654435761) ^ ((cycle.orderIndex + 1) * 1597334677)) >>> 0 || 1 };
  const pool: FoundryBlessing[] = [...BLESSING_IDS]; const choices: FoundryBlessing[] = [];
  for (let i = 0; i < 3; i++) choices.push(pool.splice(Math.floor(random(rng) * pool.length), 1)[0]!);
  const orderIndex = cycle.orderIndex + 1;
  return { ...cycle, shards: cycle.shards - cost, orderIndex, roundsLeft: 2, choices,
    status: orderIndex === FOUNDRY.orderCosts.length ? "completed" : "active" };
}
export function chooseFoundryBlessing(cycle: FoundryCycle, blessing: FoundryBlessing): FoundryCycle {
  if (!cycle.choices.includes(blessing)) throw new Error("Cette bénédiction n’est pas proposée.");
  return { ...cycle, blessings: [...cycle.blessings, blessing], choices: [] };
}
/** Compact deterministic digest distinguishes a retry from a competing tab. */
export function foundryInputDigest(inputs: readonly FoundryInput[]) {
  let hash = 2166136261;
  for (const char of JSON.stringify(inputs)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
