import { BLESSINGS, BLESSING_IDS, FOUNDRY_SKILLS, FOUNDRY_CHARMS, FOUNDRY_RARITY, foundryModifiers,
  type FoundryBlessing, type FoundrySkillId, type FoundryCharmId, type FoundryModifiers } from "./foundry-catalog";
export * from "./foundry-catalog";

/** Deterministic foundry rules. World coordinates are shared with the 3D renderer. */
export const FOUNDRY = {
  version: 5, stepMs: 50, legacyMaxTicks: 1500, batchTicks: 40, maxBatchTicks: 100, maxDraftInputs: 2400,
  maxTargets: 16, width: 11.2, depth: 6.8, concentration: 100, drainPerTick: 0.1,
  roundsPerOrder: 3, baseTargets: 12, freezeEveryTicks: 60, freezeTicks: 50, berserkTicks: 60, burnTicks: 60, burnEveryTicks: 10,
  collisionPasses: 24, collisionGap: 0.001, spawnAttempts: 48,
  upgradeCosts: [50, 100, 200], orderCosts: [100, 250, 500, 900, 1500],
  legacyOrderCosts: [100, 200, 350, 550, 850],
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
export const RELIC_KINDS = ["urn", "geode", "runner", "spring", "chaos"] as const;
export type RelicKind = (typeof RELIC_KINDS)[number];
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
  choices: FoundryBlessing[]; skills?: FoundrySkillId[]; seed?: number; economy?: 2; status: "active" | "failed" | "completed" | "abandoned";
}
export interface FoundryStats { damage: number; interval: number; radius: number; critical: number; loot: number; concentration: number }
export interface FoundryRelic { id: number; kind: RelicKind; x: number; z: number; hp: number; maxHp: number; vx: number; vz: number; phase: number }
export interface FoundryInput { x: number; z: number; active: boolean }
export interface FoundryRound {
  version: 1 | 2 | 3 | 4 | 5; rng: number; nextId: number; tick: number; concentration: number;
  stats: FoundryStats; tool: FoundryTool; assistant: FoundryAssistant; nextStrike: number;
  shards: number; broken: number; hits: number; criticals: number; ended: boolean;
  targets: FoundryRelic[];
  rogue?: { modifiers: FoundryModifiers; capacity: number; pressure: number; frenzyUntil: number; frozenUntil: number; nextFreeze: number; strikes: number; jackpots: number;
    burns: { id: number; until: number; next: number }[] };

}
export interface FoundryImpact { x: number; z: number; targetId: number; kind: RelicKind; damage: number; critical: boolean; broken: boolean; loot: number }
export interface FoundryEffect { kind: "freeze" | "lightning" | "burn" | "frenzy" | "shockwave" | "jackpot"; x: number; z: number; toX?: number; toZ?: number; radius?: number }
export interface FoundryFrame { strike: boolean; impacts: FoundryImpact[]; effects?: FoundryEffect[]; strikePosition?: { x: number; z: number } }
export interface FoundrySummary { shards: number; broken: number; hits: number; criticals: number; seconds: number }

export function newFoundryCycle(number = 1, seed = Math.imul(number, 2654435761) >>> 0): FoundryCycle {
  return { number, shards: 0, orderIndex: 0, roundsLeft: FOUNDRY.roundsPerOrder, upgrades: { power: 0, focus: 0, fortune: 0 }, blessings: [], choices: [], skills: [], seed, economy: 2, status: "active" };
}
function random(state: { rng: number }) {
  let x = state.rng | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rng = x >>> 0;
  return state.rng / 4294967296;
}
export function foundryStats(cycle: FoundryCycle, tool: FoundryTool, assistant: FoundryAssistant, charms: readonly FoundryCharmId[] = []): FoundryStats {
  const modifiers = foundryModifiers(cycle, charms); const base = TOOLS[tool];
  return {
    damage: base.damage * Math.max(0.25, 1 + cycle.upgrades.power * 0.25 + modifiers.power) * (assistant === "smith" ? 1.15 : 1),
    interval: Math.max(2, Math.round(base.interval / Math.max(0.3, 1 + modifiers.cadence))),
    radius: base.radius * Math.max(0.4, 1 + modifiers.radius),
    critical: Math.max(0, Math.min(0.65, 0.1 + cycle.upgrades.fortune * 0.05 + modifiers.critical)),
    loot: Math.max(0.25, 1 + modifiers.loot) * (assistant === "feline" ? 1.15 : 1) * (1 + cycle.orderIndex * 0.08),
    concentration: Math.max(30, Math.round(100 * (1 + cycle.upgrades.focus * 0.15 + modifiers.focus) * (assistant === "dryad" ? 1.15 : 1))),
  };
}
function spawn(state: FoundryRound): FoundryRelic {
  let roll = random(state) * 100;
  const kind = RELIC_KINDS.find((id) => (roll -= RELICS[id].weight) < 0) ?? "urn";
  let x = 0; let z = 0;
  if (state.version >= 3) {
    const radius = RELICS[kind].radius;
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
  return { id: state.nextId++, kind, x, z, hp, maxHp: hp,
    vx: Math.cos(angle) * speed,
    vz: state.version === 1 ? kind === "runner" ? Math.sin(angle) * 0.027 : 0 : Math.sin(angle) * speed * (0.027 / 0.033),
    phase: random(state) * Math.PI * 2 };
}
function confineRelic(t: FoundryRelic) {
  const radius = RELICS[t.kind].radius;
  const limitX = FOUNDRY.width / 2 - radius, limitZ = FOUNDRY.depth / 2 - radius;
  if (t.x < -limitX) { t.x = -limitX; if (t.vx < 0) t.vx = -t.vx; }
  if (t.x > limitX) { t.x = limitX; if (t.vx > 0) t.vx = -t.vx; }
  if (t.z < -limitZ) { t.z = -limitZ; if (t.vz < 0) t.vz = -t.vz; }
  if (t.z > limitZ) { t.z = limitZ; if (t.vz > 0) t.vz = -t.vz; }
}
/** Elastic disc contacts, in stable target order, with no extra random draws. */
function resolveRelicContacts(targets: FoundryRelic[], bounce = true) {
  for (let pass = 0; pass < FOUNDRY.collisionPasses; pass++) {
    let corrected = false;
    for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i]!, b = targets[j]!;
      const dx = b.x - a.x, dz = b.z - a.z;
      const minimum = RELICS[a.kind].radius + RELICS[b.kind].radius;
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
    targets.forEach(confineRelic);
    if (!corrected) break;
  }
}
export function createFoundryRound(seed: number, cycle: FoundryCycle, tool: FoundryTool, assistant: FoundryAssistant, charms: readonly FoundryCharmId[] = []): FoundryRound {
  const stats = foundryStats(cycle, tool, assistant, charms);
  const modifiers = foundryModifiers(cycle, charms);
  const state: FoundryRound = { version: FOUNDRY.version, rng: (seed >>> 0) || 1, nextId: 1, tick: 0, concentration: stats.concentration,
    stats, tool, assistant, nextStrike: 0, shards: 0, broken: 0, hits: 0, criticals: 0, ended: false, targets: [],
    rogue: { modifiers, capacity: Math.min(FOUNDRY.maxTargets, FOUNDRY.baseTargets + modifiers.capacity), pressure: 1 + cycle.orderIndex * 0.2,
      frenzyUntil: 0, frozenUntil: 0, nextFreeze: FOUNDRY.freezeEveryTicks, strikes: 0, jackpots: 0, burns: [] } };
  for (let i = 0; i < state.rogue!.capacity; i++) state.targets.push(spawn(state));
  resolveRelicContacts(state.targets, false);
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
/** The build is frozen into the round; saved V4 rounds retain their original cadence and duration. */
function stepFoundryRogue(state: FoundryRound, input: FoundryInput): FoundryFrame {
  const frame: FoundryFrame = { strike: false, impacts: [], effects: [] };
  const rogue = state.rogue!; const mods = rogue.modifiers;
  state.tick++;
  const fury = rogue.frenzyUntil > state.tick;
  state.concentration = Math.max(0, state.concentration - FOUNDRY.drainPerTick * Math.max(0.25, 1 + mods.drain) * (fury ? 0.5 : 1));
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
  const base = state.stats.damage * (fury ? 1.2 : 1) * (1 + Math.min(0.25, state.broken * mods.damageGrowth));
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
    if (state.version >= 5) frame.strikePosition = { x: input.x, z: input.z };
    state.nextStrike = state.tick + Math.max(2, Math.round(state.stats.interval / (fury ? 1.5 : 1)));
    const critical = direct.length > 0 && roll(state.stats.critical);
    for (const target of direct) {
      queue.push({ target, damage: base * (critical ? Math.max(1.2, 2 + mods.criticalDamage) : 1) * (target.hp === target.maxHp ? 1 + mods.firstHitBonus : 1), critical, direct: true });
      if (roll(mods.burnChance)) {
        const previous = rogue.burns.find((burn) => burn.id === target.id);
        if (previous) previous.until = state.tick + FOUNDRY.burnTicks;
        else rogue.burns.push({ id: target.id, until: state.tick + FOUNDRY.burnTicks, next: state.tick + FOUNDRY.burnEveryTicks });
        frame.effects!.push({ kind: "burn", x: target.x, z: target.z });
      }
    }
    if (roll(mods.lightningChance)) {
      const targets = state.targets.filter((target) => !direct.includes(target) && Math.hypot(target.x - input.x, target.z - input.z) <= 4)
        .sort((a, b) => Math.hypot(a.x - input.x, a.z - input.z) - Math.hypot(b.x - input.x, b.z - input.z) || a.id - b.id)
        .slice(0, 2 + mods.lightningTargets);
      for (const target of targets) {
        queue.push({ target, damage: base * mods.lightningDamage, critical: false });
        frame.effects!.push({ kind: "lightning", x: input.x, z: input.z, toX: target.x, toZ: target.z });
      }
    }
    const firstWave = mods.firstWave > 0 && rogue.strikes === 1;
    if (firstWave || roll(mods.shockwaveChance)) {
      const radius = 2 + mods.shockwaveRadius;
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
      const bonus = 1 + (hit.critical ? mods.criticalLoot : 0) + (target.kind === "geode" ? mods.geodeLoot : 0)
        + (intact && hit.direct ? mods.oneShotLoot : 0) + Math.min(0.25, (state.broken - 1) * mods.lootGrowth);
      const jackpot = roll(mods.jackpotChance);
      loot = Math.max(1, Math.round((low + Math.floor(random(state) * (high - low + 1))) * state.stats.loot * bonus * (jackpot ? 2 : 1)));
      state.shards += loot;
      if (jackpot) { rogue.jackpots++; frame.effects!.push({ kind: "jackpot", x: target.x, z: target.z }); }
      if (target.kind === "spring") restore(8 + mods.springRecovery);
      if (state.broken === 1) restore(mods.firstKillRecovery);
      if (roll(mods.recoveryChance)) restore(2 + mods.recoveryAmount);
      if (roll(mods.berserkChance)) {
        rogue.frenzyUntil = Math.max(rogue.frenzyUntil, state.tick + FOUNDRY.berserkTicks + mods.berserkDuration);
        frame.effects!.push({ kind: "frenzy", x: target.x, z: target.z });
      }
      if (target.kind === "chaos" || roll(mods.chainChance)) {
        const chaos = target.kind === "chaos";
        for (const neighbour of state.targets) if (neighbour.id !== target.id && !destroyed.has(neighbour.id) && Math.hypot(neighbour.x - target.x, neighbour.z - target.z) <= 2)
          queue.push({ target: neighbour, damage: chaos ? 5 : base * mods.chainDamage, critical: false });
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
  return (cycle.economy === 2 ? FOUNDRY.orderCosts : FOUNDRY.legacyOrderCosts)[cycle.orderIndex];
}
export function settleFoundryRound(cycle: FoundryCycle, round: FoundryRound): FoundryCycle {
  if (!round.ended || cycle.status !== "active" || cycle.choices.length || cycle.roundsLeft <= 0) throw new Error("Cette manche ne peut pas être terminée.");
  const next = { ...cycle, shards: cycle.shards + round.shards, roundsLeft: cycle.roundsLeft - 1 };
  if (!next.roundsLeft && next.shards < foundryOrderCost(next)!) next.status = "failed";
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
export function buyFoundrySkill(cycle: FoundryCycle, id: FoundrySkillId): FoundryCycle {
  if (cycle.status !== "active" || cycle.choices.length || !cycle.roundsLeft) throw new Error("Livre d’abord la commande ou choisis ta bénédiction.");
  const skill = FOUNDRY_SKILLS[id]; const owned = cycle.skills ?? [];
  if (!skill) throw new Error("Ce savoir est inconnu.");
  if (owned.includes(id)) throw new Error("Ce savoir est déjà acquis.");
  if (!skill.requires.every((parent) => owned.includes(parent as FoundrySkillId))) throw new Error("Apprends d’abord les savoirs reliés à ce nœud.");
  if (cycle.shards < skill.cost) throw new Error("Il manque des éclats.");
  return { ...cycle, shards: cycle.shards - skill.cost, skills: [...owned, id] };
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
