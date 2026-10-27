export const MINE_KINDS = ["gold", "emeralds"] as const;
export type MineKind = (typeof MINE_KINDS)[number];
export const MINE_STORAGE_HOURS = 8;
export const HOUR_MS = 3_600_000;

export interface MineState {
  /** Fractional resources are retained between collections. */
  amount: number;
  updatedAt: number;
  level?: number;
  /** Legacy mines accrued at the Guardian level until their first rank sync. */
  heroLevel?: number;
  revision: number;
}

export interface MineBoard {
  ownerId: string;
  serverNow: number;
  rank: number;
  mineLevel: number;
  mines: Record<MineKind, MineState> | null;
}

export function mineRules(kind: MineKind, mineLevel: number) {
  const level = Number.isFinite(mineLevel)
    ? Math.max(1, Math.floor(mineLevel))
    : 1;
  const perHour = (kind === "gold" ? 6 : 2) * level;
  return { perHour, capacity: perHour * MINE_STORAGE_HOURS };
}

/** The stored level applies to elapsed time, including time spent offline. */
export function mineAmount(kind: MineKind, state: MineState, now: number) {
  const { perHour, capacity } = mineRules(kind, state.level ?? state.heroLevel ?? 1);
  const elapsed = Math.max(0, now - state.updatedAt);
  // Preserve already earned reserves when migrating a higher legacy mine.
  return Math.min(Math.max(capacity, state.amount), state.amount + (elapsed / HOUR_MS) * perHour);
}

export function mineView(kind: MineKind, state: MineState, now: number) {
  const rules = mineRules(kind, state.level ?? state.heroLevel ?? 1);
  const amount = mineAmount(kind, state, now);
  const available = Math.floor(amount);
  return {
    ...rules,
    available,
    progress: Math.min(1, amount / rules.capacity),
    full: available >= rules.capacity,
    nextInMs: Math.ceil(((1 - (amount - available)) / rules.perHour) * HOUR_MS),
  };
}

/** Settle the old rate before applying a level-up; never reprice past hours. */
export function changeMineLevel(
  kind: MineKind,
  state: MineState,
  level: number,
  now: number,
): MineState {
  if (state.level === level && state.heroLevel === undefined) return state;
  const { heroLevel: _legacyLevel, ...current } = state;
  return {
    ...current,
    amount: mineAmount(kind, state, now),
    updatedAt: Math.max(state.updatedAt, now),
    level,
  };
}
