import { FOUNDRY_GOLEM_IDS, FOUNDRY_GOLEMS, type FoundryGolemId } from './foundry-golems';

/** Browser reference: docs/references/bank-pig-progression-v16.json. */
export const FOUNDRY_PIG_LEVELS = {
  maximum: 10,
  experience: [20, 35, 60, 100, 160, 250, 400, 600, 900, 1500],
  lootPerLevel: 0.1,
  // Sylve's ten-species distribution: favour discoveries over mastered species.
  weightDecayPerLevel: 0.075,
  minimumWeight: 0.25,
  beginnerWeight: 2,
} as const;

export type FoundryPigCounts = Partial<Record<FoundryGolemId, number>>;
export interface FoundryPigProgress {
  xp: FoundryPigCounts;
  unlocked: FoundryGolemId[];
  pending: FoundryGolemId[];
}
interface PigProgression {
  xpPerBreak: number;
  weight: number;
  pity: number;
  requires?: { pig: FoundryGolemId; level: number };
}
export const FOUNDRY_PIG_PROGRESSION: Record<FoundryGolemId, PigProgression> = {
  copper: { xpPerBreak: 1, weight: 3, pity: 0 },
  sap: { xpPerBreak: 2, weight: 2.5, pity: 8, requires: { pig: 'copper', level: 1 } },
  stone: { xpPerBreak: 1, weight: 1, pity: 18, requires: { pig: 'sap', level: 1 } },
  amber: { xpPerBreak: 1, weight: 0.8, pity: 22, requires: { pig: 'stone', level: 1 } },
  ember: { xpPerBreak: 1, weight: 0.7, pity: 22, requires: { pig: 'amber', level: 1 } },
  shrapnel: { xpPerBreak: 1, weight: 0.6, pity: 30, requires: { pig: 'ember', level: 1 } },
  furnace: { xpPerBreak: 1, weight: 0.5, pity: 30, requires: { pig: 'shrapnel', level: 1 } },
  thorn: { xpPerBreak: 1, weight: 0.6, pity: 30, requires: { pig: 'furnace', level: 1 } },
  thief: { xpPerBreak: 1, weight: 0.4, pity: 45, requires: { pig: 'thorn', level: 1 } },
  reinforcement: { xpPerBreak: 1, weight: 0, pity: 0, requires: { pig: 'copper', level: 2 } },
};

export function newFoundryPigProgress(): FoundryPigProgress {
  return { xp: {}, unlocked: ['copper'], pending: [] };
}
export function foundryPigLevelXP(level: number): number {
  return FOUNDRY_PIG_LEVELS.experience.slice(0, Math.max(0, Math.min(FOUNDRY_PIG_LEVELS.maximum, level))).reduce((sum, xp) => sum + xp, 0);
}
export function foundryPigLevel(progress: FoundryPigProgress, pig: FoundryGolemId): number {
  const xp = progress.xp[pig] ?? 0;
  let level = 0;
  while (level < FOUNDRY_PIG_LEVELS.maximum && xp >= foundryPigLevelXP(level + 1)) level++;
  return level;
}
export function foundryPigLootMultiplier(progress: FoundryPigProgress, pig: FoundryGolemId): number {
  return 1 + foundryPigLevel(progress, pig) * FOUNDRY_PIG_LEVELS.lootPerLevel;
}

/** Older chantiers retain every species they could already encounter, without inventing XP. */
export function foundryPigProgress(cycle: { pigs?: FoundryPigProgress; orderIndex: number }): FoundryPigProgress {
  if (cycle.pigs) return { xp: { ...cycle.pigs.xp }, unlocked: [...cycle.pigs.unlocked], pending: [...cycle.pigs.pending] };
  return { xp: {}, pending: [], unlocked: FOUNDRY_GOLEM_IDS.filter(id => FOUNDRY_GOLEMS[id].unlock <= cycle.orderIndex) };
}

/** Called once for each confirmed destruction, including abilities and delayed explosions. */
export function gainFoundryPigXP(progress: FoundryPigProgress, pig: FoundryGolemId, count = 1) {
  const before = foundryPigLevel(progress, pig);
  progress.xp[pig] = Math.min(foundryPigLevelXP(FOUNDRY_PIG_LEVELS.maximum), (progress.xp[pig] ?? 0) + FOUNDRY_PIG_PROGRESSION[pig].xpPerBreak * count);
  const unlocked: FoundryGolemId[] = [];
  for (const id of FOUNDRY_GOLEM_IDS) {
    const requirement = FOUNDRY_PIG_PROGRESSION[id].requires;
    if (!progress.unlocked.includes(id) && requirement && progress.unlocked.includes(requirement.pig) && foundryPigLevel(progress, requirement.pig) >= requirement.level) {
      progress.unlocked.push(id);
      unlocked.push(id);
      if (FOUNDRY_PIG_PROGRESSION[id].weight > 0) progress.pending.push(id);
    }
  }
  return { before, level: foundryPigLevel(progress, pig), unlocked };
}

export function foundryPigWeight(progress: FoundryPigProgress, pig: FoundryGolemId): number {
  if (!progress.unlocked.includes(pig)) return 0;
  const level = foundryPigLevel(progress, pig);
  return FOUNDRY_PIG_PROGRESSION[pig].weight
    * Math.max(FOUNDRY_PIG_LEVELS.minimumWeight, 1 - level * FOUNDRY_PIG_LEVELS.weightDecayPerLevel)
    * (level === 0 ? FOUNDRY_PIG_LEVELS.beginnerWeight : 1);
}

export function foundryPigPool(progress: FoundryPigProgress, live: readonly { golem?: FoundryGolemId }[] = [], pendingBombs = 0) {
  return FOUNDRY_GOLEM_IDS.filter(id => {
    const cap = FOUNDRY_GOLEMS[id].maxOnDesk;
    return foundryPigWeight(progress, id) > 0 && (!cap || live.filter(pig => pig.golem === id).length + (id === 'furnace' ? pendingBombs : 0) < cap);
  });
}
export function foundryPigDistribution(progress: FoundryPigProgress) {
  const pool = foundryPigPool(progress);
  const total = pool.reduce((sum, pig) => sum + foundryPigWeight(progress, pig), 0);
  return Object.fromEntries(FOUNDRY_GOLEM_IDS.map(pig => [pig, total ? foundryPigWeight(progress, pig) / total : 0])) as Record<FoundryGolemId, number>;
}

/** A discovery appears at the next free spawn; pity prevents a rare species from vanishing indefinitely. */
export function selectFoundryPig(progress: FoundryPigProgress, live: readonly { golem?: FoundryGolemId }[], pendingBombs: number, pity: FoundryPigCounts, random: () => number): FoundryGolemId {
  const pool = foundryPigPool(progress, live, pendingBombs);
  const pending = progress.pending.findIndex(pig => pool.includes(pig));
  let selected = pending >= 0 ? progress.pending.splice(pending, 1)[0] : undefined;
  if (!selected) {
    selected = pool.filter(pig => FOUNDRY_PIG_PROGRESSION[pig].pity > 0 && (pity[pig] ?? 0) >= FOUNDRY_PIG_PROGRESSION[pig].pity)
      .sort((a, b) => (pity[b] ?? 0) / FOUNDRY_PIG_PROGRESSION[b].pity - (pity[a] ?? 0) / FOUNDRY_PIG_PROGRESSION[a].pity)[0];
  }
  if (!selected) {
    let ticket = random() * pool.reduce((sum, pig) => sum + foundryPigWeight(progress, pig), 0);
    selected = pool.find(pig => (ticket -= foundryPigWeight(progress, pig)) < 0) ?? 'copper';
  }
  for (const pig of pool) pity[pig] = pig === selected ? 0 : (pity[pig] ?? 0) + 1;
  return selected;
}

export function nextFoundryPigUnlock(progress: FoundryPigProgress) {
  return FOUNDRY_GOLEM_IDS.find(pig => !progress.unlocked.includes(pig));
}
